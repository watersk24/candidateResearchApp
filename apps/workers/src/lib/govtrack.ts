import axios from "axios";

const BASE_URL = "https://www.govtrack.us/api/v2";

const http = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

export interface GovTrackVote {
  vote__congress: number;
  vote__chamber: string; // "senate" | "house"
  vote__session: string;
  vote__number: number;
  vote__date: string;
  vote__description: string;
  vote__source_url: string;
  option__value: string; // "Yea" | "Nay" | "Not Voting" | "Present" | "Speaker"
}

// GovTrack stores bioguide IDs on their person objects, so we can cross-reference
// with a bioguideId obtained from Congress.gov.
export async function findGovTrackPersonId(
  bioguideId: string
): Promise<number | null> {
  try {
    const response = await http.get<{
      objects: Array<{ id: number; bioguideid: string; firstname: string; lastname: string }>;
    }>("/person", {
      params: { bioguideid: bioguideId, limit: 1 },
    });
    return response.data.objects?.[0]?.id ?? null;
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response) {
      const status = err.response.status;
      // 404 = member not in GovTrack (not found); treat as null
      // 5xx = GovTrack is down; rethrow so BullMQ retries the job
      if (status === 404) {
        console.warn(`[govtrack] findPersonId("${bioguideId}") → 404 (not found)`);
        return null;
      }
      console.warn(`[govtrack] findPersonId("${bioguideId}") → HTTP ${status} (will retry)`);
    }
    throw err;
  }
}

export async function getMemberVotes(
  govTrackPersonId: number,
  offset = 0
): Promise<GovTrackVote[]> {
  try {
    const response = await http.get<{ objects: GovTrackVote[] }>("/vote_voter", {
      params: {
        person: govTrackPersonId,
        limit: 20,
        offset,
        order_by: "-created",
        fields: [
          "vote__congress",
          "vote__chamber",
          "vote__session",
          "vote__number",
          "vote__date",
          "vote__description",
          "vote__source_url",
          "option__value",
        ].join(","),
      },
    });
    return response.data.objects ?? [];
  } catch (err: unknown) {
    if (isAxiosError(err) && err.response) {
      const status = err.response.status;
      if (status === 404) {
        console.warn(`[govtrack] getMemberVotes(${govTrackPersonId}) → 404`);
        return [];
      }
      console.warn(`[govtrack] getMemberVotes(${govTrackPersonId}) → HTTP ${status} (will retry)`);
    }
    throw err;
  }
}

function isAxiosError(err: unknown): err is { response?: { status: number } } {
  return typeof err === "object" && err !== null && "response" in err;
}
