import axios from "axios";
import { load } from "cheerio";

const BASE_URL = "https://www.senate.gov/legislative/LIS";
const REQUEST_TIMEOUT = 15_000;

export interface SenateVoteMenuItem {
  rollNumber: number;
  voteDate: string; // "January 03, 2025"
  issue: string;    // bill number or motion description
  question: string;
  result: string;
  title: string;
  sourceUrl: string; // XML URL (official record)
}

export interface SenateMemberVote {
  lastName: string;
  firstName: string;
  party: string;
  state: string;
  voteCast: string; // "Yea" | "Nay" | "Not Voting" | "Present" | "Absent"
  lisMemberId: string;
}

export function senateVoteXmlUrl(congress: number, session: number, rollNumber: number): string {
  const padded = String(rollNumber).padStart(5, "0");
  return `${BASE_URL}/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${padded}.xml`;
}

// Fetches the session vote menu and returns the most-recent `limit` votes.
// URL: https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_{congress}_{session}.xml
export async function getSenateVoteMenu(
  congress: number,
  session: number,
  limit = 50
): Promise<SenateVoteMenuItem[]> {
  const url = `${BASE_URL}/roll_call_lists/vote_menu_${congress}_${session}.xml`;
  try {
    const { data } = await axios.get<string>(url, {
      responseType: "text",
      timeout: REQUEST_TIMEOUT,
    });

    const $ = load(data, { xmlMode: true });
    const items: SenateVoteMenuItem[] = [];

    $("vote_summary votes vote").each((_, el) => {
      const rollNumber = parseInt($(el).find("vote_number").text().trim(), 10);
      if (isNaN(rollNumber)) return;
      items.push({
        rollNumber,
        voteDate: $(el).find("vote_date").text().trim(),
        issue: $(el).find("issue").text().trim(),
        question: $(el).find("question").text().trim(),
        result: $(el).find("result").text().trim(),
        title: $(el).find("title").text().trim(),
        sourceUrl: senateVoteXmlUrl(congress, session, rollNumber),
      });
    });

    // Vote menu lists oldest first; reverse so most-recent are first.
    return items.reverse().slice(0, limit);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) {
      console.warn(`[senate] vote menu not found for ${congress}/${session}`);
      return [];
    }
    throw err;
  }
}

// Fetches member-level positions for a single roll call vote.
// URL: https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{roll:05d}.xml
export async function getSenateVoteMemberPositions(
  congress: number,
  session: number,
  rollNumber: number
): Promise<SenateMemberVote[]> {
  const url = senateVoteXmlUrl(congress, session, rollNumber);
  try {
    const { data } = await axios.get<string>(url, {
      responseType: "text",
      timeout: REQUEST_TIMEOUT,
    });

    const $ = load(data, { xmlMode: true });
    const members: SenateMemberVote[] = [];

    $("roll_call_vote members member").each((_, el) => {
      members.push({
        lastName: $(el).find("last_name").text().trim(),
        firstName: $(el).find("first_name").text().trim(),
        party: $(el).find("party").text().trim(),
        state: $(el).find("state").text().trim(),
        voteCast: $(el).find("vote_cast").text().trim(),
        lisMemberId: $(el).find("lis_member_id").text().trim(),
      });
    });

    return members;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) {
      return [];
    }
    throw err;
  }
}

function isAxiosError(err: unknown): err is { response?: { status: number } } {
  return typeof err === "object" && err !== null && "response" in err;
}
