import { DataStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";

// Articles per outlet category required before a sentiment score is shown.
const MIN_SENTIMENT_ARTICLES = 50;

type CandidateWithData = Prisma.CandidateGetPayload<{
  include: {
    votingRecords: true;
    campaignFinanceRecords: true;
    publicStatements: true;
    legalHistory: true;
    newsArticles: {
      include: { outlet: { select: { bias: true } } };
    };
  };
}>;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// ── Transparency Score (0–100) ────────────────────────────────────────────────
// Components: voting 40%, finance 30%, statements 20%, legal 10%.
// Each component is scored 0–100 and stored separately.

export function computeTransparency(candidate: CandidateWithData) {
  const sourceVotes = candidate.votingRecords.filter((r) => r.sourceAvailable).length;
  const votingComponent = Math.round(clamp(Math.min(sourceVotes / 10, 1) * 100));

  const hasFinance = candidate.campaignFinanceRecords.length > 0;
  const allComplete = hasFinance && candidate.campaignFinanceRecords.every((r) => r.filingComplete);
  const financeComponent = !hasFinance ? 0 : allComplete ? 100 : 50;

  const statementComponent = Math.round(clamp(Math.min(candidate.publicStatements.length / 5, 1) * 100));

  // Legal: 100 if entries found (transparency confirmed), 50 if no entries (uncertain)
  const legalComponent = candidate.legalHistory.length > 0 ? 100 : 50;

  const transparencyScore = Math.round(
    (votingComponent / 100) * 40 +
    (financeComponent / 100) * 30 +
    (statementComponent / 100) * 20 +
    (legalComponent / 100) * 10
  );

  return {
    transparencyScore: clamp(transparencyScore),
    transparencyVotingPct: votingComponent,
    transparencyFinancePct: financeComponent,
    transparencyStatementPct: statementComponent,
    transparencyLegalPct: legalComponent,
  };
}

// ── Sentiment Score ───────────────────────────────────────────────────────────
// Average positive-sentiment probability per outlet bias category.
// Null when fewer than MIN_SENTIMENT_ARTICLES are available for that category.

export function computeSentiment(candidate: CandidateWithData) {
  const byBias = (bias: string) =>
    candidate.newsArticles
      .filter((a) => a.outlet.bias === bias && a.sentimentPositive !== null)
      .map((a) => a.sentimentPositive as number);

  const conservative = byBias("conservative");
  const liberal = byBias("liberal");
  const neutral = byBias("neutral");
  const totalAnalyzed = candidate.newsArticles.filter((a) => a.sentimentPositive !== null).length;

  return {
    sentimentConservative: conservative.length >= MIN_SENTIMENT_ARTICLES ? avg(conservative) : null,
    sentimentLiberal: liberal.length >= MIN_SENTIMENT_ARTICLES ? avg(liberal) : null,
    sentimentNeutral: neutral.length >= MIN_SENTIMENT_ARTICLES ? avg(neutral) : null,
    sentimentArticleCount: totalAnalyzed,
  };
}

// ── Factual Consistency Score (0–100) ─────────────────────────────────────────
// Proxy formula used for all candidates until position-comparison logic is built:
//   attendance rate (0–40) + compliance record (0–30) + position docs (0–30)

export function computeFactualConsistency(candidate: CandidateWithData) {
  const totalVotes = candidate.votingRecords.length;
  const presentVotes = candidate.votingRecords.filter((r) => r.vote !== "absent").length;

  // Attendance: % of votes where candidate was present and cast a position
  const attendanceRate = totalVotes > 0 ? presentVotes / totalVotes : 0;
  const attendanceScore = Math.round(clamp(attendanceRate * 40, 0, 40));

  // Compliance: no violation data yet — partial credit pending future data source
  const complianceScore = 20;

  // Position documentation: public statements on record
  const positionDocScore = Math.round(clamp(Math.min(candidate.publicStatements.length / 5, 1) * 30, 0, 30));

  const factualConsistencyScore = clamp(attendanceScore + complianceScore + positionDocScore);

  return { attendanceScore, complianceScore, positionDocScore, factualConsistencyScore };
}

// ── Campaign Finance Score (0–100) ────────────────────────────────────────────
// Scores the most recent filing period.
//   individual donors (0–50) + PAC penalty (0–25) + party transfer penalty (0–15) + completeness (0–10)

export function computeCampaignFinance(candidate: CandidateWithData): number | null {
  const record = candidate.campaignFinanceRecords[0];
  if (!record) return null;

  const indPct = record.individualDonorPct ? record.individualDonorPct.toNumber() : 0;
  const pacPct = record.pacDonorPct ? record.pacDonorPct.toNumber() : 0;
  const partyPct = record.partyTransferPct ? record.partyTransferPct.toNumber() : 0;

  const indScore = clamp((indPct / 100) * 50, 0, 50);
  const pacScore = clamp((1 - pacPct / 100) * 25, 0, 25);
  const partyScore = clamp((1 - partyPct / 100) * 15, 0, 15);
  const completeScore = record.filingComplete ? 10 : 0;

  return Math.round(clamp(indScore + pacScore + partyScore + completeScore));
}

// ── Data Status ───────────────────────────────────────────────────────────────

export function computeDataStatus(candidate: CandidateWithData): DataStatus {
  if (candidate.hasLimitedData) return "limited";
  if (candidate.dataIsStale) return "stale";
  if (!candidate.lastRefreshedAt) return "limited";

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  if (candidate.lastRefreshedAt < thirtyDaysAgo) return "stale";

  return "current";
}

// ── Scraper entry point ───────────────────────────────────────────────────────

export async function computeRatings(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      votingRecords: true,
      campaignFinanceRecords: { orderBy: { filingPeriod: "desc" }, take: 4 },
      publicStatements: true,
      legalHistory: true,
      newsArticles: {
        include: { outlet: { select: { bias: true } } },
      },
    },
  });

  if (!candidate) {
    console.warn(`[computeRatings] candidate ${candidateId} not found`);
    return;
  }

  const transparency = computeTransparency(candidate);
  const sentiment = computeSentiment(candidate);
  const factual = computeFactualConsistency(candidate);
  const campaignFinanceScore = computeCampaignFinance(candidate);
  const dataStatus = computeDataStatus(candidate);

  await prisma.candidateRatings.upsert({
    where: { candidateId },
    create: {
      candidateId,
      ...transparency,
      ...sentiment,
      ...factual,
      campaignFinanceScore,
      dataStatus,
    },
    update: {
      ...transparency,
      ...sentiment,
      ...factual,
      campaignFinanceScore,
      dataStatus,
      computedAt: new Date(),
    },
  });

  console.log(
    `[computeRatings] "${candidate.fullName}" — transparency=${transparency.transparencyScore} ` +
    `factual=${factual.factualConsistencyScore} finance=${campaignFinanceScore ?? "n/a"} ` +
    `status=${dataStatus}`
  );
}
