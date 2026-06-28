import axios from "axios";

const BASE_URL = "https://api.congress.gov/v3";
const PAGE_LIMIT = 250;
// Max members per call; 500 reliably returns all ~430 House members in one request.
const MEMBER_POSITIONS_LIMIT = 500;

function client() {
  const key = process.env.CONGRESS_API_KEY;
  if (!key) throw new Error("CONGRESS_API_KEY environment variable is required");
  return axios.create({
    baseURL: BASE_URL,
    params: { api_key: key, format: "json" },
    timeout: 15_000,
  });
}

// ── Member lookup ─────────────────────────────────────────────────────────────

export interface CongressMember {
  bioguideId: string;
  name: string; // "Last, First" format
  partyName: string;
  state: string;
  district?: number;
  terms: {
    item: Array<{ chamber: string; startYear: number; endYear?: number }>;
  };
}

// The /member chamber filter is unreliable — fetch all current members and filter client-side.
async function fetchAllCurrentMembers(): Promise<CongressMember[]> {
  const http = client();
  const all: CongressMember[] = [];

  for (let offset = 0; offset < 1000; offset += PAGE_LIMIT) {
    try {
      const response = await http.get<{
        members: CongressMember[];
        pagination: { count: number; total: number };
      }>("/member", {
        params: { currentMember: true, limit: PAGE_LIMIT, offset },
      });

      const page = response.data.members ?? [];
      all.push(...page);

      const { total } = response.data.pagination ?? { total: 0 };
      if (all.length >= total || page.length < PAGE_LIMIT) break;
    } catch (err: unknown) {
      if (isAxiosError(err) && err.response) {
        console.warn(`[congress] fetchAllCurrentMembers offset=${offset} → HTTP ${err.response.status}`);
        break;
      }
      throw err;
    }
  }

  return all;
}

function normalizeName(apiName: string): { lastName: string; firstName: string } {
  const [lastPart = "", firstPart = ""] = apiName.split(",").map((s) => s.trim().toLowerCase());
  return { lastName: lastPart, firstName: firstPart };
}

function memberChamber(member: CongressMember): "house" | "senate" | null {
  const terms = member.terms?.item ?? [];
  const last = terms.at(-1);
  if (!last) return null;
  if (last.chamber === "Senate") return "senate";
  if (last.chamber === "House of Representatives") return "house";
  return null;
}

export async function findMemberByName(
  fullName: string,
  chamber: "house" | "senate"
): Promise<CongressMember | null> {
  const members = await fetchAllCurrentMembers();
  const chamberMembers = members.filter((m) => memberChamber(m) === chamber);

  const searchLower = fullName.toLowerCase();
  const searchLastName = searchLower.split(" ").at(-1) ?? "";
  const searchFirstNames = searchLower.split(" ").slice(0, -1);

  // Pass 1: last name + first name starts-with (handles "Chuck" matching "Charles")
  for (const m of chamberMembers) {
    const { lastName, firstName } = normalizeName(m.name);
    if (lastName !== searchLastName) continue;
    const match = searchFirstNames.some(
      (fn) => firstName.startsWith(fn) || fn.startsWith(firstName.split(" ")[0])
    );
    if (match) return m;
  }

  // Pass 2: last name only fallback
  return chamberMembers.find((m) => normalizeName(m.name).lastName === searchLastName) ?? null;
}

// ── House roll call votes (beta endpoints, 118th Congress 2023+) ──────────────

export interface HouseRollCallVote {
  rollCallNumber: number;
  sessionNumber: number;
  congress: number;
  startDate: string;
  result: string;
  legislationNumber?: string;
  legislationType?: string;
  sourceDataURL: string; // clerk.house.gov XML
  url: string;
}

export interface HouseMemberVote {
  bioguideID: string;
  firstName: string;
  lastName: string;
  voteCast: string; // "Yea" | "Nay" | "Present" | "Not Voting" | "Speaker"
  voteParty: string;
  voteState: string;
}

// Returns the current congress number and session number based on the current date.
// 119th Congress: Jan 2025 – Jan 2027; session 1 = 2025, session 2 = 2026.
export function getCurrentCongressSession(): { congress: number; session: number } {
  const year = new Date().getFullYear();
  const congress = Math.floor((year - 1789) / 2) + 1;
  const session = year % 2 === 1 ? 1 : 2;
  return { congress, session };
}

export async function getHouseVoteList(
  congress: number,
  session: number,
  limit = 50
): Promise<HouseRollCallVote[]> {
  const http = client();
  try {
    const response = await http.get<{
      houseRollCallVotes: HouseRollCallVote[];
    }>(`/house-vote/${congress}/${session}`, { params: { limit } });
    return response.data.houseRollCallVotes ?? [];
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response) {
      console.warn(`[congress] getHouseVoteList(${congress}/${session}) → HTTP ${err.response.status}`);
      return [];
    }
    throw err;
  }
}

export async function getHouseVoteMemberPositions(
  congress: number,
  session: number,
  rollCallNumber: number
): Promise<HouseMemberVote[]> {
  const http = client();
  try {
    const response = await http.get<{
      houseRollCallVoteMemberVotes: {
        congress: number;
        results: HouseMemberVote[];
      };
    }>(`/house-vote/${congress}/${session}/${rollCallNumber}/members`, {
      params: { limit: MEMBER_POSITIONS_LIMIT },
    });
    return response.data.houseRollCallVoteMemberVotes?.results ?? [];
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response) {
      console.warn(
        `[congress] getHouseVoteMemberPositions(${congress}/${session}/${rollCallNumber}) → HTTP ${err.response.status}`
      );
      return [];
    }
    throw err;
  }
}

function isAxiosError(err: unknown): err is { response?: { status: number } } {
  return typeof err === "object" && err !== null && "response" in err;
}
