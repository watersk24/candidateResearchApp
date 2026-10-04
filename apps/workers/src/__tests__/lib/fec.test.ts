/**
 * fec.ts tests
 *
 * Covers:
 *  - fecProfileUrl(): pure URL formatter (Priority 1 — no mocks needed)
 *  - searchCandidate(): mocked axios (Priority 2)
 *  - getCandidateTotals(): mocked axios (Priority 2)
 *  - listRaceCandidates(): race-scoped listing with pagination
 *  - Retry with backoff on HTTP 429
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

import { fecProfileUrl, searchCandidate, getCandidateTotals, listRaceCandidates } from "../../lib/fec.js";

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

describe("getCandidateTotals per-cycle rows", () => {
  beforeEach(() => {
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get });
    axiosMocks.get.mockReset();
  });

  it("requests per-cycle rows only, not election-to-date rows without a cycle", async () => {
    axiosMocks.get.mockResolvedValue({ data: { results: [] } });

    await getCandidateTotals("H0TN09096");

    expect(axiosMocks.get).toHaveBeenCalledWith("/candidate/H0TN09096/totals/", {
      params: expect.objectContaining({ election_full: "false" }),
    });
  });
});

describe("listRaceCandidates", () => {
  beforeEach(() => {
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get });
    axiosMocks.get.mockReset();
  });

  it("queries one House race by year, state, office, and district", async () => {
    axiosMocks.get.mockResolvedValue({ data: { results: [{ candidate_id: "H1" }], pagination: { pages: 1 } } });

    const result = await listRaceCandidates({ electionYear: 2026, state: "NC", office: "H", district: "01" });

    expect(result).toEqual([{ candidate_id: "H1" }]);
    expect(axiosMocks.get).toHaveBeenCalledWith("/candidates/", {
      params: { election_year: 2026, state: "NC", office: "H", district: "01", per_page: 100, page: 1 },
    });
  });

  it("omits district for a Senate race", async () => {
    axiosMocks.get.mockResolvedValue({ data: { results: [], pagination: { pages: 1 } } });

    await listRaceCandidates({ electionYear: 2026, state: "NC", office: "S" });

    expect(axiosMocks.get.mock.calls[0][1].params).not.toHaveProperty("district");
  });

  it("throws instead of returning a partial list when the FEC reports too many pages", async () => {
    axiosMocks.get.mockResolvedValue({ data: { results: [{ candidate_id: "S1" }], pagination: { pages: 9999 } } });

    await expect(listRaceCandidates({ electionYear: 2026, state: "NC", office: "S" })).rejects.toThrow(
      "FEC reported 9999 pages for one race"
    );
    expect(axiosMocks.get).toHaveBeenCalledTimes(1);
  });

  it("throws when a page before the last comes back empty", async () => {
    axiosMocks.get
      .mockResolvedValueOnce({ data: { results: [{ candidate_id: "S1" }], pagination: { pages: 3 } } })
      .mockResolvedValueOnce({ data: { results: [], pagination: { pages: 3 } } });

    await expect(listRaceCandidates({ electionYear: 2026, state: "NC", office: "S" })).rejects.toThrow(
      "FEC returned an empty page 2 of 3"
    );
  });

  it("returns an empty list when the only page is empty", async () => {
    axiosMocks.get.mockResolvedValue({ data: { results: [], pagination: { pages: 1 } } });

    expect(await listRaceCandidates({ electionYear: 2026, state: "NC", office: "S" })).toEqual([]);
  });

  it("follows pagination until the last page", async () => {
    axiosMocks.get
      .mockResolvedValueOnce({ data: { results: [{ candidate_id: "S1" }], pagination: { pages: 2 } } })
      .mockResolvedValueOnce({ data: { results: [{ candidate_id: "S2" }], pagination: { pages: 2 } } });

    const result = await listRaceCandidates({ electionYear: 2026, state: "NC", office: "S" });

    expect(result.map((c) => c.candidate_id)).toEqual(["S1", "S2"]);
    expect(axiosMocks.get).toHaveBeenCalledTimes(2);
  });
});

describe("retry on HTTP 429", () => {
  beforeEach(() => {
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get });
    axiosMocks.get.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries after the Retry-After delay and returns the result", async () => {
    axiosMocks.get
      .mockRejectedValueOnce({ response: { status: 429, headers: { "retry-after": "2" } } })
      .mockResolvedValueOnce({ data: { results: [{ cycle: 2026 }] } });

    const promise = getCandidateTotals("H0TN09096");
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await promise).toEqual([{ cycle: 2026 }]);
    expect(axiosMocks.get).toHaveBeenCalledTimes(2);
  });

  it("waits at most 60 seconds whatever Retry-After says", async () => {
    axiosMocks.get
      .mockRejectedValueOnce({ response: { status: 429, headers: { "retry-after": "86400" } } })
      .mockResolvedValueOnce({ data: { results: [] } });

    const promise = getCandidateTotals("H0TN09096");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(await promise).toEqual([]);
    expect(axiosMocks.get).toHaveBeenCalledTimes(2);
  });

  it("gives up after three retries", async () => {
    const throttled = { response: { status: 429, headers: {} } };
    axiosMocks.get.mockRejectedValue(throttled);

    const promise = getCandidateTotals("H0TN09096");
    const assertion = expect(promise).rejects.toBe(throttled);
    await vi.advanceTimersByTimeAsync(5_000 + 15_000 + 45_000);

    await assertion;
    expect(axiosMocks.get).toHaveBeenCalledTimes(4);
  });

  it("does not retry other errors", async () => {
    const notFound = { response: { status: 404 } };
    axiosMocks.get.mockRejectedValue(notFound);

    await expect(getCandidateTotals("H0TN09096")).rejects.toBe(notFound);
    expect(axiosMocks.get).toHaveBeenCalledTimes(1);
  });
});
