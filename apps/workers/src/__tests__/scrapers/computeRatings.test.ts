import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => ({
  candidate: { findUnique: vi.fn() },
  candidateRatings: { upsert: vi.fn() },
}));

vi.mock("../../lib/db.js", () => ({ prisma: mockDb }));

import {
  computeRatings,
  computeTransparency,
  computeSentiment,
  computeFactualConsistency,
  computeCampaignFinance,
  computeDataStatus,
  clamp,
} from "../../scrapers/computeRatings.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVotingRecord(vote: string, sourceAvailable = true) {
  return { id: `vr-${Math.random()}`, vote, sourceAvailable };
}

function makeFinanceRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: `fr-${Math.random()}`,
    filingPeriod: "2024",
    filingComplete: true,
    individualDonorPct: new Decimal("60"),
    pacDonorPct: new Decimal("20"),
    partyTransferPct: new Decimal("10"),
    totalRaised: new Decimal("500000"),
    totalSpent: new Decimal("400000"),
    sourceUrl: "https://www.fec.gov",
    sourceAvailable: true,
    ...overrides,
  };
}

function makeNewsArticle(bias: string, sentimentPositive: number | null = 0.7) {
  return {
    id: `na-${Math.random()}`,
    outlet: { bias },
    sentimentPositive,
    sentimentScore: sentimentPositive,
    sentiment: sentimentPositive !== null ? "positive" : null,
    sentimentNegative: sentimentPositive !== null ? 1 - sentimentPositive : null,
    sentimentNeutral: null,
    analyzedAt: sentimentPositive !== null ? new Date() : null,
  };
}

function makeStatement() {
  return { id: `ps-${Math.random()}` };
}

function makeLegalEntry() {
  return { id: `le-${Math.random()}` };
}

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "cand-1",
    fullName: "Jane Doe",
    hasLimitedData: false,
    dataIsStale: false,
    lastRefreshedAt: new Date(),
    votingRecords: [],
    campaignFinanceRecords: [],
    publicStatements: [],
    legalHistory: [],
    newsArticles: [],
    ...overrides,
  };
}

// ── clamp ─────────────────────────────────────────────────────────────────────

describe("clamp", () => {
  it("returns value when within range", () => expect(clamp(50)).toBe(50));
  it("clamps to min", () => expect(clamp(-5)).toBe(0));
  it("clamps to max", () => expect(clamp(110)).toBe(100));
  it("respects custom bounds", () => expect(clamp(45, 0, 40)).toBe(40));
});

// ── computeTransparency ───────────────────────────────────────────────────────

describe("computeTransparency", () => {
  it("scores 0 transparency with no data at all", () => {
    const candidate = makeCandidate();
    const result = computeTransparency(candidate as never);
    // legal component defaults to 50 (uncertain) → 10% of 50 = 5
    expect(result.transparencyScore).toBe(5);
    expect(result.transparencyVotingPct).toBe(0);
    expect(result.transparencyFinancePct).toBe(0);
    expect(result.transparencyStatementPct).toBe(0);
    expect(result.transparencyLegalPct).toBe(50);
  });

  it("awards full voting component at 10+ records with sources", () => {
    const votes = Array.from({ length: 10 }, () => makeVotingRecord("yea", true));
    const candidate = makeCandidate({ votingRecords: votes });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyVotingPct).toBe(100);
  });

  it("scales voting component linearly below 10 records", () => {
    const votes = Array.from({ length: 5 }, () => makeVotingRecord("yea", true));
    const candidate = makeCandidate({ votingRecords: votes });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyVotingPct).toBe(50);
  });

  it("only counts records where sourceAvailable=true for voting component", () => {
    const votes = [
      makeVotingRecord("yea", true),
      makeVotingRecord("nay", false),
      makeVotingRecord("yea", false),
    ];
    const candidate = makeCandidate({ votingRecords: votes });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyVotingPct).toBe(10); // 1/10 = 10%
  });

  it("awards 100 finance component when records exist and all filings complete", () => {
    const candidate = makeCandidate({ campaignFinanceRecords: [makeFinanceRecord()] });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyFinancePct).toBe(100);
  });

  it("awards 50 finance component when records exist but some incomplete", () => {
    const candidate = makeCandidate({
      campaignFinanceRecords: [makeFinanceRecord({ filingComplete: false })],
    });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyFinancePct).toBe(50);
  });

  it("awards 0 finance component when no finance records", () => {
    const candidate = makeCandidate({ campaignFinanceRecords: [] });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyFinancePct).toBe(0);
  });

  it("awards full statement component at 5+ statements", () => {
    const stmts = Array.from({ length: 5 }, makeStatement);
    const candidate = makeCandidate({ publicStatements: stmts });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyStatementPct).toBe(100);
  });

  it("awards 100 legal component when legal entries found", () => {
    const candidate = makeCandidate({ legalHistory: [makeLegalEntry()] });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyLegalPct).toBe(100);
  });

  it("awards 50 legal component when no legal entries (uncertain, not confirmed absence)", () => {
    const candidate = makeCandidate({ legalHistory: [] });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyLegalPct).toBe(50);
  });

  it("computes weighted transparency score correctly", () => {
    // voting=100 (40%), finance=100 (30%), statement=100 (20%), legal=100 (10%) = 100
    const votes = Array.from({ length: 10 }, () => makeVotingRecord("yea", true));
    const stmts = Array.from({ length: 5 }, makeStatement);
    const candidate = makeCandidate({
      votingRecords: votes,
      campaignFinanceRecords: [makeFinanceRecord()],
      publicStatements: stmts,
      legalHistory: [makeLegalEntry()],
    });
    const result = computeTransparency(candidate as never);
    expect(result.transparencyScore).toBe(100);
  });
});

// ── computeSentiment ──────────────────────────────────────────────────────────

describe("computeSentiment", () => {
  it("returns null for categories with fewer than 50 articles", () => {
    const articles = Array.from({ length: 49 }, () => makeNewsArticle("conservative", 0.8));
    const candidate = makeCandidate({ newsArticles: articles });
    const result = computeSentiment(candidate as never);
    expect(result.sentimentConservative).toBeNull();
  });

  it("computes average sentimentPositive when ≥ 50 articles", () => {
    const articles = Array.from({ length: 50 }, () => makeNewsArticle("liberal", 0.6));
    const candidate = makeCandidate({ newsArticles: articles });
    const result = computeSentiment(candidate as never);
    expect(result.sentimentLiberal).toBeCloseTo(0.6);
  });

  it("excludes articles with null sentimentPositive from average", () => {
    const articles = [
      ...Array.from({ length: 50 }, () => makeNewsArticle("neutral", 0.8)),
      makeNewsArticle("neutral", null), // should be excluded
    ];
    const candidate = makeCandidate({ newsArticles: articles });
    const result = computeSentiment(candidate as never);
    expect(result.sentimentNeutral).toBeCloseTo(0.8);
  });

  it("counts only articles with non-null sentimentPositive in sentimentArticleCount", () => {
    const articles = [
      ...Array.from({ length: 3 }, () => makeNewsArticle("conservative", 0.5)),
      makeNewsArticle("liberal", null),
    ];
    const candidate = makeCandidate({ newsArticles: articles });
    const result = computeSentiment(candidate as never);
    expect(result.sentimentArticleCount).toBe(3);
  });

  it("returns null for all categories when no articles exist", () => {
    const candidate = makeCandidate({ newsArticles: [] });
    const result = computeSentiment(candidate as never);
    expect(result.sentimentConservative).toBeNull();
    expect(result.sentimentLiberal).toBeNull();
    expect(result.sentimentNeutral).toBeNull();
    expect(result.sentimentArticleCount).toBe(0);
  });
});

// ── computeFactualConsistency ─────────────────────────────────────────────────

describe("computeFactualConsistency", () => {
  it("returns attendanceScore=0 when no voting records", () => {
    const candidate = makeCandidate({ votingRecords: [] });
    const result = computeFactualConsistency(candidate as never);
    expect(result.attendanceScore).toBe(0);
  });

  it("calculates attendance as (present votes / total votes) * 40", () => {
    const votes = [
      makeVotingRecord("yea"),
      makeVotingRecord("nay"),
      makeVotingRecord("absent"),
      makeVotingRecord("absent"),
    ];
    // 2 present out of 4 = 50% → 50% * 40 = 20
    const candidate = makeCandidate({ votingRecords: votes });
    const result = computeFactualConsistency(candidate as never);
    expect(result.attendanceScore).toBe(20);
  });

  it("counts yea, nay, and present as attendance (not absent)", () => {
    const votes = [
      makeVotingRecord("yea"),
      makeVotingRecord("nay"),
      makeVotingRecord("present"),
    ];
    const candidate = makeCandidate({ votingRecords: votes });
    const result = computeFactualConsistency(candidate as never);
    expect(result.attendanceScore).toBe(40); // 3/3 = 100% → 40pts
  });

  it("awards partial compliance credit (20/30) when no data source available", () => {
    const candidate = makeCandidate();
    const result = computeFactualConsistency(candidate as never);
    expect(result.complianceScore).toBe(20);
  });

  it("scales positionDocScore by public statements (max at 5)", () => {
    const stmts = Array.from({ length: 5 }, makeStatement);
    const candidate = makeCandidate({ publicStatements: stmts });
    const result = computeFactualConsistency(candidate as never);
    expect(result.positionDocScore).toBe(30);
  });

  it("sums sub-scores into factualConsistencyScore", () => {
    const votes = Array.from({ length: 10 }, () => makeVotingRecord("yea"));
    const stmts = Array.from({ length: 5 }, makeStatement);
    const candidate = makeCandidate({ votingRecords: votes, publicStatements: stmts });
    const result = computeFactualConsistency(candidate as never);
    // attendance=40, compliance=20, positionDoc=30 → 90
    expect(result.factualConsistencyScore).toBe(90);
  });
});

// ── computeCampaignFinance ────────────────────────────────────────────────────

describe("computeCampaignFinance", () => {
  it("returns null when no finance records", () => {
    const candidate = makeCandidate({ campaignFinanceRecords: [] });
    expect(computeCampaignFinance(candidate as never)).toBeNull();
  });

  it("scores 100 for ideal donor composition: 100% individual, 0% PAC, 0% party, complete", () => {
    const record = makeFinanceRecord({
      individualDonorPct: new Decimal("100"),
      pacDonorPct: new Decimal("0"),
      partyTransferPct: new Decimal("0"),
      filingComplete: true,
    });
    const candidate = makeCandidate({ campaignFinanceRecords: [record] });
    expect(computeCampaignFinance(candidate as never)).toBe(100);
  });

  it("deducts for high PAC percentage", () => {
    const baseline = makeFinanceRecord({
      individualDonorPct: new Decimal("50"),
      pacDonorPct: new Decimal("0"),
      partyTransferPct: new Decimal("0"),
      filingComplete: false,
    });
    const highPac = makeFinanceRecord({
      individualDonorPct: new Decimal("50"),
      pacDonorPct: new Decimal("100"),
      partyTransferPct: new Decimal("0"),
      filingComplete: false,
    });
    const baseCand = makeCandidate({ campaignFinanceRecords: [baseline] });
    const pacCand = makeCandidate({ campaignFinanceRecords: [highPac] });
    const baseScore = computeCampaignFinance(baseCand as never)!;
    const pacScore = computeCampaignFinance(pacCand as never)!;
    expect(pacScore).toBeLessThan(baseScore);
  });

  it("awards 10 bonus points for complete filings", () => {
    const incomplete = makeFinanceRecord({ filingComplete: false });
    const complete = makeFinanceRecord({ filingComplete: true });
    const incompleteCand = makeCandidate({ campaignFinanceRecords: [incomplete] });
    const completeCand = makeCandidate({ campaignFinanceRecords: [complete] });
    const diff =
      computeCampaignFinance(completeCand as never)! -
      computeCampaignFinance(incompleteCand as never)!;
    expect(diff).toBe(10);
  });

  it("uses the first (most recent) finance record only", () => {
    const recent = makeFinanceRecord({ individualDonorPct: new Decimal("100") });
    const older = makeFinanceRecord({ individualDonorPct: new Decimal("0") });
    const candidate = makeCandidate({ campaignFinanceRecords: [recent, older] });
    const score = computeCampaignFinance(candidate as never)!;
    expect(score).toBeGreaterThan(50);
  });
});

// ── computeDataStatus ─────────────────────────────────────────────────────────

describe("computeDataStatus", () => {
  it('returns "limited" when hasLimitedData is true', () => {
    const candidate = makeCandidate({ hasLimitedData: true });
    expect(computeDataStatus(candidate as never)).toBe("limited");
  });

  it('returns "stale" when dataIsStale is true', () => {
    const candidate = makeCandidate({ dataIsStale: true });
    expect(computeDataStatus(candidate as never)).toBe("stale");
  });

  it('returns "limited" when lastRefreshedAt is null', () => {
    const candidate = makeCandidate({ lastRefreshedAt: null });
    expect(computeDataStatus(candidate as never)).toBe("limited");
  });

  it('returns "stale" when lastRefreshedAt is more than 30 days ago', () => {
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 31);
    const candidate = makeCandidate({ lastRefreshedAt: staleDate });
    expect(computeDataStatus(candidate as never)).toBe("stale");
  });

  it('returns "current" when data is fresh and not limited', () => {
    const candidate = makeCandidate({ lastRefreshedAt: new Date() });
    expect(computeDataStatus(candidate as never)).toBe("current");
  });
});

// ── computeRatings (orchestration) ───────────────────────────────────────────

describe("computeRatings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.candidateRatings.upsert.mockResolvedValue({});
  });

  it("returns early when candidate not found", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(null);
    await computeRatings("nonexistent");
    expect(mockDb.candidateRatings.upsert).not.toHaveBeenCalled();
  });

  it("calls upsert with computed scores", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(
      makeCandidate({ lastRefreshedAt: new Date() })
    );
    await computeRatings("cand-1");
    expect(mockDb.candidateRatings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { candidateId: "cand-1" },
        create: expect.objectContaining({ candidateId: "cand-1" }),
        update: expect.objectContaining({ dataStatus: "current" }),
      })
    );
  });

  it("includes all score fields in the upsert payload", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(
      makeCandidate({ lastRefreshedAt: new Date() })
    );
    await computeRatings("cand-1");
    const call = mockDb.candidateRatings.upsert.mock.calls[0][0];
    expect(call.create).toHaveProperty("transparencyScore");
    expect(call.create).toHaveProperty("factualConsistencyScore");
    expect(call.create).toHaveProperty("campaignFinanceScore");
    expect(call.create).toHaveProperty("sentimentArticleCount");
    expect(call.create).toHaveProperty("dataStatus");
  });
});
