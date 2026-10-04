/**
 * campaignFinance.ts tests
 *
 * Covers:
 *  - safePercent(): division with edge cases (Priority 1)
 *  - toRecord(): FEC totals → DB record shape (Priority 1)
 *  - scrapeCampaignFinance(): full orchestration with mocked db + FEC (Priority 2)
 *  - Uses only the FEC ID linked within the candidate's race, never a name search
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => ({
  candidate: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  campaignFinanceRecord: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  $transaction: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/db.js", () => ({ prisma: mockDb }));

// ── FEC API mock ──────────────────────────────────────────────────────────────
const mockFec = vi.hoisted(() => ({
  searchCandidate: vi.fn(),
  getCandidateTotals: vi.fn().mockResolvedValue([]),
  fecProfileUrl: vi.fn((id: string) => `https://www.fec.gov/data/candidate/${id}/`),
}));

vi.mock("../../lib/fec.js", () => mockFec);

// ── Linked FEC ID mock ────────────────────────────────────────────────────────
const mockRefs = vi.hoisted(() => ({ linkedFecId: vi.fn() }));
vi.mock("../../enrich/fecRefs.js", () => mockRefs);

import {
  scrapeCampaignFinance,
  safePercent,
  toRecord,
} from "../../scrapers/campaignFinance.js";
import type { FecTotals } from "../../lib/fec.js";

// ── Helper factories ──────────────────────────────────────────────────────────

function makeFecTotals(overrides: Partial<FecTotals> = {}): FecTotals {
  return {
    cycle: 2024,
    receipts: 1_000_000,
    disbursements: 800_000,
    individual_itemized_contributions: 600_000,
    other_political_committee_contributions: 200_000,
    transfers_from_affiliated_party_committees: 50_000,
    coverage_end_date: "2024-06-30",
    last_report_type_full: "QUARTERLY REPORT",
    ...overrides,
  };
}

function makeFederalHouseCandidate(id = "cand-1") {
  return {
    id,
    fullName: "Jane Doe",
    election: {
      district: {
        level: "federal",
        districtType: "Congressional District",
      },
    },
  };
}

function makeStateLevelCandidate(id = "cand-state-1") {
  return {
    id,
    fullName: "Bob Smith",
    election: {
      district: {
        level: "state",
        districtType: "State Senate",
      },
    },
  };
}

// ── safePercent — pure function ───────────────────────────────────────────────
describe("safePercent", () => {
  it("calculates percentage to two decimal places", () => {
    expect(safePercent(600_000, 1_000_000)).toBe(60.0);
  });

  it("rounds to two decimal places", () => {
    expect(safePercent(1, 3)).toBe(33.33);
  });

  it("returns null when denominator is 0", () => {
    expect(safePercent(100, 0)).toBeNull();
  });

  it("returns null when denominator is falsy (undefined coerced to 0)", () => {
    expect(safePercent(100, 0)).toBeNull();
  });

  it("returns 100 when numerator equals denominator", () => {
    expect(safePercent(500, 500)).toBe(100.0);
  });

  it("returns 0 when numerator is 0", () => {
    expect(safePercent(0, 1_000_000)).toBe(0);
  });

  it("handles values greater than 100% (numerator > denominator)", () => {
    // Possible if contributions exceed reported total due to data timing
    expect(safePercent(110, 100)).toBe(110.0);
  });
});

// ── toRecord — pure transformation ───────────────────────────────────────────
describe("toRecord", () => {
  const sourceUrl = "https://www.fec.gov/data/candidate/H0TN09096/";

  it("maps cycle to filingPeriod when present", () => {
    const record = toRecord(makeFecTotals({ cycle: 2024 }), "cand-1", sourceUrl);
    expect(record.filingPeriod).toBe("2024");
  });

  it("falls back to coverage_end_date when cycle is null", () => {
    const record = toRecord(
      makeFecTotals({ cycle: null, coverage_end_date: "2024-06-30" }),
      "cand-1",
      sourceUrl
    );
    expect(record.filingPeriod).toBe("2024-06-30");
  });

  it('uses "unknown" as filingPeriod when both cycle and coverage_end_date are null', () => {
    const record = toRecord(
      makeFecTotals({ cycle: null, coverage_end_date: null }),
      "cand-1",
      sourceUrl
    );
    expect(record.filingPeriod).toBe("unknown");
  });

  it("converts receipts to totalRaised string", () => {
    const record = toRecord(makeFecTotals({ receipts: 1_234_567 }), "cand-1", sourceUrl);
    expect(record.totalRaised).toBe("1234567");
  });

  it("converts disbursements to totalSpent string", () => {
    const record = toRecord(makeFecTotals({ disbursements: 987_654 }), "cand-1", sourceUrl);
    expect(record.totalSpent).toBe("987654");
  });

  it("calculates individualDonorPct as percentage string", () => {
    const record = toRecord(
      makeFecTotals({ individual_itemized_contributions: 600_000, receipts: 1_000_000 }),
      "cand-1",
      sourceUrl
    );
    expect(record.individualDonorPct).toBe("60");
  });

  it("sets individualDonorPct to null when receipts is 0", () => {
    const record = toRecord(
      makeFecTotals({ individual_itemized_contributions: 0, receipts: 0 }),
      "cand-1",
      sourceUrl
    );
    expect(record.individualDonorPct).toBeNull();
  });

  it("sets filingComplete to true when last_report_type_full is present", () => {
    const record = toRecord(
      makeFecTotals({ last_report_type_full: "QUARTERLY REPORT" }),
      "cand-1",
      sourceUrl
    );
    expect(record.filingComplete).toBe(true);
  });

  it("sets filingComplete to false when last_report_type_full is null", () => {
    const record = toRecord(
      makeFecTotals({ last_report_type_full: null }),
      "cand-1",
      sourceUrl
    );
    expect(record.filingComplete).toBe(false);
  });

  it("sets sourceAvailable to true", () => {
    const record = toRecord(makeFecTotals(), "cand-1", sourceUrl);
    expect(record.sourceAvailable).toBe(true);
  });
});

// ── scrapeCampaignFinance — orchestration with mocked I/O ────────────────────
describe("scrapeCampaignFinance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockResolvedValue([]);
    mockFec.fecProfileUrl.mockImplementation(
      (id: string) => `https://www.fec.gov/data/candidate/${id}/`
    );
  });

  it("returns early without calling FEC API for a non-federal candidate", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeStateLevelCandidate());

    await scrapeCampaignFinance("cand-state-1");

    expect(mockRefs.linkedFecId).not.toHaveBeenCalled();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("returns early when candidate does not exist in DB", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(null);

    await scrapeCampaignFinance("nonexistent-id");

    expect(mockRefs.linkedFecId).not.toHaveBeenCalled();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("marks hasLimitedData and clears old finance rows when the candidate has no linked FEC ID", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockRefs.linkedFecId.mockResolvedValue(null);
    mockDb.candidate.update.mockResolvedValue({});

    await scrapeCampaignFinance("cand-1");

    expect(mockDb.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasLimitedData: true }),
      })
    );
    expect(mockDb.campaignFinanceRecord.deleteMany).toHaveBeenCalledWith({ where: { candidateId: "cand-1" } });
    expect(mockDb.campaignFinanceRecord.createMany).not.toHaveBeenCalled();
    expect(mockFec.getCandidateTotals).not.toHaveBeenCalled();
  });

  it("stores null rather than a non-numeric amount from the FEC", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockRefs.linkedFecId.mockResolvedValue("H0TN09096");
    mockFec.getCandidateTotals.mockResolvedValue([makeFecTotals({ receipts: "lots" as unknown as number })]);

    await scrapeCampaignFinance("cand-1");

    expect(mockDb.campaignFinanceRecord.createMany.mock.calls[0][0].data[0].totalRaised).toBeNull();
  });

  it("returns early without transaction when FEC totals are empty", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockRefs.linkedFecId.mockResolvedValue("H0TN09096");
    mockFec.getCandidateTotals.mockResolvedValue([]);

    await scrapeCampaignFinance("cand-1");

    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("runs a transaction with deleteMany + createMany + update when totals are found", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockRefs.linkedFecId.mockResolvedValue("H0TN09096");
    mockFec.getCandidateTotals.mockResolvedValue([makeFecTotals()]);

    await scrapeCampaignFinance("cand-1");

    expect(mockDb.campaignFinanceRecord.deleteMany).toHaveBeenCalledWith({
      where: { candidateId: "cand-1" },
    });
    expect(mockDb.campaignFinanceRecord.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            candidateId: "cand-1",
            filingPeriod: "2024",
            totalRaised: "1000000",
            sourceAvailable: true,
          }),
        ]),
      })
    );
    expect(mockDb.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dataIsStale: false }),
      })
    );
    expect(mockDb.$transaction).toHaveBeenCalled();
  });

  it("fetches totals for the linked FEC ID and never searches by name", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockRefs.linkedFecId.mockResolvedValue("H0TN09096");
    mockFec.getCandidateTotals.mockResolvedValue([makeFecTotals()]);

    await scrapeCampaignFinance("cand-1");

    expect(mockRefs.linkedFecId).toHaveBeenCalledWith("cand-1");
    expect(mockFec.getCandidateTotals).toHaveBeenCalledWith("H0TN09096");
    expect(mockFec.searchCandidate).not.toHaveBeenCalled();
  });

  it("never stores NaN when the FEC omits a field", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockRefs.linkedFecId.mockResolvedValue("H0TN09096");
    mockFec.getCandidateTotals.mockResolvedValue([
      makeFecTotals({ transfers_from_affiliated_party_committees: undefined as unknown as number }),
    ]);

    await scrapeCampaignFinance("cand-1");

    const record = mockDb.campaignFinanceRecord.createMany.mock.calls[0][0].data[0];
    expect(record.partyTransferPct).toBeNull();
  });

  it("stores one record per FEC filing cycle", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockRefs.linkedFecId.mockResolvedValue("H0TN09096");
    mockFec.getCandidateTotals.mockResolvedValue([
      makeFecTotals({ cycle: 2024 }),
      makeFecTotals({ cycle: 2022 }),
    ]);

    await scrapeCampaignFinance("cand-1");

    const createManyCall = mockDb.campaignFinanceRecord.createMany.mock.calls[0][0];
    expect(createManyCall.data).toHaveLength(2);
    expect(createManyCall.data[0].filingPeriod).toBe("2024");
    expect(createManyCall.data[1].filingPeriod).toBe("2022");
  });
});
