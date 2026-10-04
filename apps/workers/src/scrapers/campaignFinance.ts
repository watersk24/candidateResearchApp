import { prisma } from "../lib/db.js";
import { getCandidateTotals, fecProfileUrl, type FecTotals } from "../lib/fec.js";
import { linkedFecId } from "../enrich/fecRefs.js";

export function safePercent(numerator: number, denominator: number): number | null {
  // The FEC omits some fields; never store NaN
  if (!denominator || !Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  return Math.round((numerator / denominator) * 10000) / 100; // two decimal places
}

// The FEC response is untrusted input; store only finite numbers
function amount(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

export function toRecord(totals: FecTotals, candidateId: string, sourceUrl: string) {
  const { receipts, disbursements } = totals;
  return {
    candidateId,
    filingPeriod: totals.cycle != null ? totals.cycle.toString() : totals.coverage_end_date ?? "unknown",
    totalRaised: amount(receipts),
    totalSpent: amount(disbursements),
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

  // Only an FEC ID linked within the candidate's own race is used (ADR-008
  // Slice 4); a nationwide name search could attach another person's filings.
  const fecId = await linkedFecId(candidateId);

  if (!fecId) {
    console.warn(
      `[campaignFinance] no linked FEC ID for "${candidate.fullName}"; run FEC linking first`
    );
    // Clear rows from a link that has since been removed, so they stop displaying
    await prisma.$transaction([
      prisma.campaignFinanceRecord.deleteMany({ where: { candidateId } }),
      prisma.candidate.update({
        where: { id: candidateId },
        data: { hasLimitedData: true },
      }),
    ]);
    return;
  }

  console.log(`[campaignFinance] "${candidate.fullName}" → FEC ID ${fecId}`);

  const totals = await getCandidateTotals(fecId);
  if (totals.length === 0) {
    console.warn(`[campaignFinance] no totals found for FEC ID ${fecId}`);
    return;
  }

  const sourceUrl = fecProfileUrl(fecId);
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
