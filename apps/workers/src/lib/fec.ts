import axios from "axios";

const BASE_URL = "https://api.open.fec.gov/v1";

function client() {
  const key = process.env.FEC_API_KEY;
  if (!key) throw new Error("FEC_API_KEY environment variable is required");
  return axios.create({
    baseURL: BASE_URL,
    params: { api_key: key },
    timeout: 15_000,
  });
}

// Waits before each retry after HTTP 429; the FEC throttles bursts even
// within the hourly key limit
const RETRY_DELAYS_MS = [5_000, 15_000, 45_000];
const MAX_RETRY_AFTER_MS = 60_000;
// A race has far fewer than 1,000 filers; more pages means a bad response
const MAX_PAGES = 10;

async function fecGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const http = client();
  for (let attempt = 0; ; attempt++) {
    try {
      return (await http.get<T>(path, { params })).data;
    } catch (err) {
      const response = (err as { response?: { status?: number; headers?: Record<string, string> } }).response;
      if (response?.status !== 429 || attempt >= RETRY_DELAYS_MS.length) throw err;
      const retryAfterSeconds = Number(response.headers?.["retry-after"]);
      const delay =
        retryAfterSeconds > 0 ? Math.min(retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS) : RETRY_DELAYS_MS[attempt];
      console.warn(`[fec] HTTP 429 on ${path}; retrying in ${delay / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export interface FecCandidate {
  candidate_id: string;
  name: string;
  party: string;
  state: string;
  district: string | null;
  office: "H" | "S" | "P"; // House, Senate, President
  cycles: number[];
}

/** A candidate as returned by `/candidates/` (the race-scoped listing). */
export interface FecRaceCandidate extends FecCandidate {
  incumbent_challenge: "I" | "C" | "O" | null; // incumbent, challenger, open seat
  has_raised_funds: boolean;
  last_file_date: string | null;
}

export interface FecTotals {
  cycle: number | null;
  receipts: number;
  disbursements: number;
  individual_itemized_contributions: number;
  other_political_committee_contributions: number;
  transfers_from_affiliated_party_committees: number;
  coverage_end_date: string | null;
  last_report_type_full: string | null;
}

export async function searchCandidate(
  fullName: string,
  office?: "H" | "S" | "P"
): Promise<FecCandidate | null> {
  const params: Record<string, string> = { q: fullName };
  if (office) params.office = office;

  const data = await fecGet<{
    results: FecCandidate[];
    pagination: { count: number };
  }>("/candidates/search/", params);

  const results = data.results ?? [];
  if (results.length === 0) return null;

  const nameLower = fullName.toLowerCase();
  const exact = results.find((r) => r.name.toLowerCase() === nameLower);
  return exact ?? results[0];
}

/**
 * Every candidate who filed with the FEC for one race. Includes primary losers
 * and withdrawn candidates: the FEC does not record who is on the general
 * ballot, so this is only for matching candidates already known from another
 * source (ADR-008 Slice 4).
 */
export async function listRaceCandidates(race: {
  electionYear: number;
  state: string; // two-letter, e.g. "NC"
  office: "H" | "S";
  district?: string; // two digits for House, e.g. "01"; omitted for Senate
}): Promise<FecRaceCandidate[]> {
  // Throws rather than returning a partial list: callers unlink candidates
  // missing from it
  const results: FecRaceCandidate[] = [];
  for (let page = 1; ; page++) {
    const params: Record<string, string | number> = {
      election_year: race.electionYear,
      state: race.state,
      office: race.office,
      per_page: 100,
      page,
    };
    if (race.district) params.district = race.district;

    const data = await fecGet<{
      results: FecRaceCandidate[];
      pagination: { pages: number };
    }>("/candidates/", params);

    const pages = data.pagination?.pages ?? 1;
    if (pages > MAX_PAGES) throw new Error(`FEC reported ${pages} pages for one race`);
    const pageResults = data.results ?? [];
    if (pageResults.length === 0 && page < pages) throw new Error(`FEC returned an empty page ${page} of ${pages}`);
    results.push(...pageResults);
    if (page >= pages) return results;
  }
}

export async function getCandidateTotals(
  candidateId: string,
  cycle?: number
): Promise<FecTotals[]> {
  const params: Record<string, string | number> = {
    sort: "-cycle",
    per_page: 4, // last 4 cycles
    // Per-cycle rows only; the election-to-date rows have no cycle and repeat
    // the same money
    election_full: "false",
  };
  if (cycle) params.cycle = cycle;

  const data = await fecGet<{ results: FecTotals[] }>(`/candidate/${candidateId}/totals/`, params);
  return data.results ?? [];
}

export function fecProfileUrl(candidateId: string): string {
  return `https://www.fec.gov/data/candidate/${candidateId}/`;
}
