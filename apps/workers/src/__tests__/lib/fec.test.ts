/**
 * fec.ts tests
 *
 * Covers:
 *  - fecProfileUrl(): pure URL formatter (Priority 1 — no mocks needed)
 *  - searchCandidate(): mocked axios (Priority 2)
 *  - getCandidateTotals(): mocked axios (Priority 2)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── axios mock ────────────────────────────────────────────────────────────────
const axiosMocks = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: axiosMocks.create,
  },
}));

import { fecProfileUrl, searchCandidate, getCandidateTotals } from "../../lib/fec.js";

// ── fecProfileUrl — pure function ────────────────────────────────────────────
describe("fecProfileUrl", () => {
  it("formats the FEC candidate profile URL correctly", () => {
    expect(fecProfileUrl("H0TN09096")).toBe(
      "https://www.fec.gov/data/candidate/H0TN09096/"
    );
  });

  it("preserves case in the candidate ID", () => {
    expect(fecProfileUrl("S4WI00061")).toBe(
      "https://www.fec.gov/data/candidate/S4WI00061/"
    );
  });

  it("includes a trailing slash", () => {
    const url = fecProfileUrl("P00000001");
    expect(url.endsWith("/")).toBe(true);
  });
});

// ── searchCandidate — mocked axios ───────────────────────────────────────────
describe("searchCandidate", () => {
  beforeEach(() => {
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get });
    axiosMocks.get.mockReset();
  });

  it("returns exact name match when available", async () => {
    const exactMatch = {
      candidate_id: "H0TN09096",
      name: "JANE DOE",
      party: "DEM",
      state: "TN",
      district: "09",
      office: "H" as const,
      cycles: [2024],
    };
    const otherResult = { ...exactMatch, candidate_id: "H0TN00000", name: "JANE DOES" };

    axiosMocks.get.mockResolvedValue({
      data: { results: [otherResult, exactMatch], pagination: { count: 2 } },
    });

    const result = await searchCandidate("Jane Doe");
    expect(result?.candidate_id).toBe("H0TN09096");
  });

  it("returns first result when no exact name match exists", async () => {
    const firstResult = {
      candidate_id: "H0TN09096",
      name: "JANE DOE SR",
      party: "DEM",
      state: "TN",
      district: "09",
      office: "H" as const,
      cycles: [2024],
    };

    axiosMocks.get.mockResolvedValue({
      data: { results: [firstResult], pagination: { count: 1 } },
    });

    const result = await searchCandidate("Jane Doe");
    expect(result?.candidate_id).toBe("H0TN09096");
  });

  it("returns null when no results found", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { results: [], pagination: { count: 0 } },
    });

    const result = await searchCandidate("Unknown Person");
    expect(result).toBeNull();
  });

  it("passes the office filter as a query parameter when provided", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { results: [], pagination: { count: 0 } },
    });

    await searchCandidate("Jane Doe", "H");

    expect(axiosMocks.get).toHaveBeenCalledWith(
      "/candidates/search/",
      expect.objectContaining({
        params: expect.objectContaining({ office: "H" }),
      })
    );
  });

  it("does not pass office parameter when undefined", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { results: [], pagination: { count: 0 } },
    });

    await searchCandidate("Jane Doe");

    const callParams = axiosMocks.get.mock.calls[0][1].params;
    expect(callParams).not.toHaveProperty("office");
  });

  it("performs case-insensitive name matching", async () => {
    const candidate = {
      candidate_id: "H0TN09096",
      name: "JANE DOE",
      party: "DEM",
      state: "TN",
      district: "09",
      office: "H" as const,
      cycles: [2024],
    };

    axiosMocks.get.mockResolvedValue({
      data: { results: [candidate], pagination: { count: 1 } },
    });

    // The FEC API returns names in uppercase; searchCandidate compares lowercase
    const result = await searchCandidate("jane doe");
    expect(result?.candidate_id).toBe("H0TN09096");
  });
});

// ── getCandidateTotals — mocked axios ────────────────────────────────────────
describe("getCandidateTotals", () => {
  beforeEach(() => {
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get });
    axiosMocks.get.mockReset();
  });

  it("returns totals array on success", async () => {
    const fakeTotals = [
      {
        cycle: 2024,
        receipts: 1_000_000,
        disbursements: 800_000,
        individual_itemized_contributions: 600_000,
        other_political_committee_contributions: 200_000,
        transfers_from_affiliated_party_committees: 50_000,
        coverage_end_date: "2024-06-30",
        last_report_type_full: "QUARTERLY REPORT",
      },
    ];

    axiosMocks.get.mockResolvedValue({ data: { results: fakeTotals } });

    const result = await getCandidateTotals("H0TN09096");
    expect(result).toEqual(fakeTotals);
  });

  it("returns empty array when results is missing", async () => {
    axiosMocks.get.mockResolvedValue({ data: {} });

    const result = await getCandidateTotals("H0TN09096");
    expect(result).toEqual([]);
  });
});
