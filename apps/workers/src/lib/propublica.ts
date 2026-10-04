import axios from "axios";

const BASE_URL = "https://api.propublica.org/congress/v1";
const CURRENT_CONGRESS = 119;

function client() {
  const key = process.env.PROPUBLICA_API_KEY;
  if (!key) throw new Error("PROPUBLICA_API_KEY environment variable is required");
  return axios.create({
    baseURL: BASE_URL,
    headers: { "X-API-Key": key },
    timeout: 15_000,
  });
}

export interface ProPublicaMemberResult {
  id: string;
  first_name: string;
  last_name: string;
  party: string;
  state: string;
  chamber: string;
  roles: Array<{
    congress: string;
    chamber: string;
    title: string;
    state: string;
    party: string;
  }>;
}

export interface ProPublicaVote {
  member_id: string;
  chamber: string;
  congress: string;
  session: string;
  roll_call: string;
  bill: {
    bill_id: string | null;
    number: string | null;
    bill_uri: string | null;
    title: string | null;
    latest_action: string | null;
  };
  description: string;
  question: string;
  result: string;
  date: string;
  time: string;
  total: { yes: number; no: number; present: number; not_voting: number };
  position: "Yes" | "No" | "Not Voting" | "Present" | "Speaker" | string;
}

// The ProPublica /members/search.json endpoint is unreliable (returns 500 for valid
// queries). Instead, fetch all members for a chamber and filter by name — this is
// the approach recommended in ProPublica's own examples.
async function listMembers(
  chamber: "house" | "senate",
  congress = CURRENT_CONGRESS
): Promise<ProPublicaMemberResult[]> {
  const http = client();
  try {
    const response = await http.get<{
      status: string;
      results: Array<{ members: ProPublicaMemberResult[] }>;
    }>(`/${congress}/${chamber}/members.json`);
    return response.data.results?.[0]?.members ?? [];
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response) {
      console.warn(
        `[propublica] listMembers(${chamber}) → HTTP ${err.response.status}`
      );
      return [];
    }
    throw err;
  }
}

export async function findMemberByName(
  fullName: string,
  chamber: "house" | "senate"
): Promise<ProPublicaMemberResult | null> {
  const members = await listMembers(chamber);
  const nameLower = fullName.toLowerCase();

  // Exact full-name match first
  const exact = members.find(
    (m) => `${m.first_name} ${m.last_name}`.toLowerCase() === nameLower
  );
  if (exact) return exact;

  // Last-name-only fallback (helpful when seed data omits middle names)
  const lastName = nameLower.split(" ").at(-1) ?? "";
  return members.find((m) => m.last_name.toLowerCase() === lastName) ?? null;
}

export async function getMemberVotes(
  memberId: string,
  offset = 0
): Promise<ProPublicaVote[]> {
  const http = client();
  try {
    const response = await http.get<{
      status: string;
      results: Array<{ votes: ProPublicaVote[] }>;
    }>(`/members/${memberId}/votes.json`, { params: { offset } });
    return response.data.results?.[0]?.votes ?? [];
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response) {
      console.warn(
        `[propublica] getMemberVotes("${memberId}") → HTTP ${err.response.status}`
      );
      return [];
    }
    throw err;
  }
}

function isAxiosError(err: unknown): err is { response?: { status: number } } {
  return typeof err === "object" && err !== null && "response" in err;
}
