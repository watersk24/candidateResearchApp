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

export interface FecCandidate {
  candidate_id: string;
  name: string;
  party: string;
  state: string;
  district: string | null;
  office: "H" | "S" | "P"; // House, Senate, President
  cycles: number[];
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
  const http = client();
  const params: Record<string, string> = { q: fullName };
  if (office) params.office = office;

  const response = await http.get<{
    results: FecCandidate[];
    pagination: { count: number };
  }>("/candidates/search/", { params });

  const results = response.data.results ?? [];
  if (results.length === 0) return null;

  const nameLower = fullName.toLowerCase();
  const exact = results.find((r) => r.name.toLowerCase() === nameLower);
  return exact ?? results[0];
}

export async function getCandidateTotals(
  candidateId: string,
  cycle?: number
): Promise<FecTotals[]> {
  const http = client();
  const params: Record<string, string | number> = {
    sort: "-cycle",
    per_page: 4, // last 4 cycles
  };
  if (cycle) params.cycle = cycle;

  const response = await http.get<{
    results: FecTotals[];
  }>(`/candidate/${candidateId}/totals/`, { params });

  return response.data.results ?? [];
}

export function fecProfileUrl(candidateId: string): string {
  return `https://www.fec.gov/data/candidate/${candidateId}/`;
}
