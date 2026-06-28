import { prisma } from "../lib/db.js";
import { searchCandidate, getCandidateTotals, fecProfileUrl, type FecTotals } from "../lib/fec.js";

function inferOffice(districtType: string): "H" | "S" | "P" | undefined {
  const lower = districtType.toLowerCase();
  if (lower.includes("house") || lower.includes("congressional")) return "H";
  if (lower.includes("senate")) return "S";
  if (lower.includes("president")) return "P";
  return undefined;
}

function safePercent(numerator: number, denominator: number): number | null {
  if (!denominator || denominator === 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100; // two decimal places
}

function toRecord(totals: FecTotals, candidateId: string, sourceUrl: string) {
  const { receipts, disbursements } = totals;
  return {
    candidateId,
    filingPeriod: totals.cycle != null ? totals.cycle.toString() : totals.coverage_end_date ?? "unknown",
    totalRaised: receipts != null ? receipts.toString() : null,
    totalSpent: disbursements != null ? disbursements.toString() : null,
    individualDonorPct: safePercent(
      totals.individual_itemized_contributions,
      receipts
    )?.toString() ?? null,
    pacDonorPct: safePercent(
      totals.other_political_committee_contributions,
      receipts
    )?.toString() ?? null,
    partyTransferPct: safePercent(
      totals.transfers_from_affiliated_party_committees,
      receipts
    )?.toString() ?? null,
    filingComplete: totals.last_report_type_full != null,
    sourceUrl,
    sourceAvailable: true as const,
  };
}

export async function scrapeCampaignFinance(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      election: {
        include: {
          district: true,
        },
      },
    },
  });

  if (!candidate) {
    console.warn(`[campaignFinance] candidate ${candidateId} not found`);
    return;
  }

  if (candidate.election.district.level !== "federal") {
    console.log(
      `[campaignFinance] skipping non-federal candidate "${candidate.fullName}"`
    );
    return;
  }

  const office = inferOffice(candidate.election.district.districtType);
  const fecCandidate = await searchCandidate(candidate.fullName, office);

  if (!fecCandidate) {
    console.warn(
      `[campaignFinance] no FEC candidate found for "${candidate.fullName}"`
    );
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { hasLimitedData: true },
    });
    return;
  }

  console.log(
    `[campaignFinance] "${candidate.fullName}" → FEC ID ${fecCandidate.candidate_id}`
  );

  const totals = await getCandidateTotals(fecCandidate.candidate_id);
  if (totals.length === 0) {
    console.warn(
      `[campaignFinance] no totals found for FEC ID ${fecCandidate.candidate_id}`
    );
    return;
  }

  const sourceUrl = fecProfileUrl(fecCandidate.candidate_id);
  const records = totals.map((t) => toRecord(t, candidateId, sourceUrl));

  await prisma.$transaction([
    prisma.campaignFinanceRecord.deleteMany({ where: { candidateId } }),
    prisma.campaignFinanceRecord.createMany({ data: records }),
    prisma.candidate.update({
      where: { id: candidateId },
      data: {
        lastRefreshedAt: new Date(),
        dataIsStale: false,
      },
    }),
  ]);

  console.log(
    `[campaignFinance] stored ${records.length} filing periods for "${candidate.fullName}"`
  );
}
