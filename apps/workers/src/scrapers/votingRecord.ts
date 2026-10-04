import { VoteChoice } from "@prisma/client";
import { prisma } from "../lib/db.js";
import {
  findMemberByName,
  getHouseVoteList,
  getHouseVoteMemberPositions,
  getCurrentCongressSession,
  type HouseRollCallVote,
  type HouseMemberVote,
} from "../lib/congress.js";
import {
  getSenateVoteMenu,
  getSenateVoteMemberPositions,
  type SenateVoteMenuItem,
  type SenateMemberVote,
} from "../lib/senate.js";

// Only roll call / recorded votes identify individual members.
// Voice votes and division votes do not — those are excluded by the API.
const RECENT_VOTES_LIMIT = 50;

export function mapVoteCast(voteCast: string): VoteChoice | null {
  switch (voteCast.toLowerCase()) {
    case "yea":
    case "aye":
      return "yea";
    case "nay":
    case "no":
      return "nay";
    case "present":
      return "present";
    case "not voting":
      return "absent";
    default:
      return null; // "Speaker" and others — not a recorded position
  }
}

export interface VoteWithPosition {
  vote: HouseRollCallVote;
  memberVote: HouseMemberVote;
}

async function fetchHouseMemberVoteHistory(
  bioguideId: string,
  congress: number,
  session: number
): Promise<VoteWithPosition[]> {
  const votes = await getHouseVoteList(congress, session, RECENT_VOTES_LIMIT);
  console.log(
    `[votingRecord] fetched ${votes.length} recent House votes for ${congress}/${session}`
  );

  const results: VoteWithPosition[] = [];
  for (const vote of votes) {
    const positions = await getHouseVoteMemberPositions(
      congress,
      session,
      vote.rollCallNumber
    );
    const memberVote = positions.find(
      (p) => p.bioguideID.toUpperCase() === bioguideId.toUpperCase()
    );
    if (memberVote) {
      results.push({ vote, memberVote });
    }
  }
  return results;
}

export function toRecords(
  voteHistory: VoteWithPosition[],
  candidateId: string
) {
  return voteHistory
    .map(({ vote, memberVote }) => {
      const voteChoice = mapVoteCast(memberVote.voteCast);
      if (!voteChoice) return null;

      const voteDate = new Date(vote.startDate);
      if (isNaN(voteDate.getTime())) return null;

      const billLabel = vote.legislationNumber
        ? `${vote.legislationType ?? ""} ${vote.legislationNumber}`.trim()
        : `Roll Call ${vote.rollCallNumber}`;

      const uniqueKey = `[${vote.congress}-H-${vote.rollCallNumber}]`;

      return {
        candidateId,
        billOrMeasure: `${uniqueKey} ${billLabel}`,
        vote: voteChoice,
        voteDate,
        sourceUrl: vote.sourceDataURL, // official clerk.house.gov XML record
        sourceAvailable: true as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

// ── Senate helpers ────────────────────────────────────────────────────────────

const SENATE_REQUEST_DELAY_MS = 150;

export interface SenateVoteWithPosition {
  voteItem: SenateVoteMenuItem;
  memberVote: SenateMemberVote;
}

// Matches senator by last name + first-name starts-with, then last-name-only fallback.
// Senate XML stores "Tammy" not "Tamara", so direct starts-with usually works.
export function findSenatorInPositions(
  positions: SenateMemberVote[],
  fullName: string
): SenateMemberVote | undefined {
  const nameLower = fullName.toLowerCase();
  const lastNameSearch = nameLower.split(" ").at(-1) ?? "";
  const firstNamesSearch = nameLower.split(" ").slice(0, -1);

  for (const m of positions) {
    if (m.lastName.toLowerCase() !== lastNameSearch) continue;
    const firstLower = m.firstName.toLowerCase();
    const match = firstNamesSearch.some(
      (fn) => firstLower.startsWith(fn) || fn.startsWith(firstLower.split(" ")[0])
    );
    if (match) return m;
  }

  return positions.find((m) => m.lastName.toLowerCase() === lastNameSearch);
}

export function senateToRecords(
  voteHistory: SenateVoteWithPosition[],
  candidateId: string,
  congress: number
) {
  return voteHistory
    .map(({ voteItem, memberVote }) => {
      const voteChoice = mapVoteCast(memberVote.voteCast);
      if (!voteChoice) return null;

      const voteDate = new Date(voteItem.voteDate);
      if (isNaN(voteDate.getTime())) return null;

      const billLabel = voteItem.issue || voteItem.title || `Roll Call ${voteItem.rollNumber}`;
      const uniqueKey = `[${congress}-S-${voteItem.rollNumber}]`;

      return {
        candidateId,
        billOrMeasure: `${uniqueKey} ${billLabel}`,
        vote: voteChoice,
        voteDate,
        sourceUrl: voteItem.sourceUrl,
        sourceAvailable: true as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

async function fetchSenateMemberVoteHistory(
  fullName: string,
  congress: number,
  session: number
): Promise<SenateVoteWithPosition[]> {
  const voteMenu = await getSenateVoteMenu(congress, session, RECENT_VOTES_LIMIT);
  console.log(
    `[votingRecord] fetched ${voteMenu.length} recent Senate votes for ${congress}/${session}`
  );

  const results: SenateVoteWithPosition[] = [];
  for (const voteItem of voteMenu) {
    // Small delay to avoid hammering Senate.gov
    await new Promise((r) => setTimeout(r, SENATE_REQUEST_DELAY_MS));
    const positions = await getSenateVoteMemberPositions(congress, session, voteItem.rollNumber);
    const memberVote = findSenatorInPositions(positions, fullName);
    if (memberVote) {
      results.push({ voteItem, memberVote });
    }
  }
  return results;
}

// ── Scraper entry point ───────────────────────────────────────────────────────

export async function scrapeVotingRecord(candidateId: string): Promise<void> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      election: {
        include: {
          district: {
            include: { jurisdiction: true },
          },
        },
      },
    },
  });

  if (!candidate) {
    console.warn(`[votingRecord] candidate ${candidateId} not found`);
    return;
  }

  if (candidate.election.district.level !== "federal") {
    console.log(`[votingRecord] skipping non-federal candidate "${candidate.fullName}"`);
    return;
  }

  const districtType = candidate.election.district.districtType.toLowerCase();
  const chamber: "house" | "senate" = districtType.includes("senate") ? "senate" : "house";
  const { congress, session } = getCurrentCongressSession();

  if (chamber === "senate") {
    const voteHistory = await fetchSenateMemberVoteHistory(candidate.fullName, congress, session);
    console.log(
      `[votingRecord] ${voteHistory.length} recorded Senate votes found for "${candidate.fullName}"`
    );
    const records = senateToRecords(voteHistory, candidateId, congress);

    await prisma.$transaction([
      prisma.votingRecord.deleteMany({ where: { candidateId } }),
      ...(records.length > 0 ? [prisma.votingRecord.createMany({ data: records })] : []),
      prisma.candidate.update({
        where: { id: candidateId },
        data: {
          lastRefreshedAt: new Date(),
          dataIsStale: false,
          hasLimitedData: records.length === 0,
        },
      }),
    ]);

    console.log(`[votingRecord] stored ${records.length} Senate records for "${candidate.fullName}"`);
    return;
  }

  // Find the member's bioguideId via Congress.gov member list
  const member = await findMemberByName(candidate.fullName, chamber);
  if (!member) {
    console.warn(`[votingRecord] no Congress.gov member found for "${candidate.fullName}"`);
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { hasLimitedData: true },
    });
    return;
  }

  console.log(
    `[votingRecord] "${candidate.fullName}" → ${member.bioguideId} (${member.name})`
  );

  // Fetch the most recent N roll call votes and check if member voted on each
  const voteHistory = await fetchHouseMemberVoteHistory(
    member.bioguideId,
    congress,
    session
  );

  console.log(
    `[votingRecord] ${voteHistory.length} recorded votes found for "${candidate.fullName}"`
  );

  const records = toRecords(voteHistory, candidateId);

  await prisma.$transaction([
    prisma.votingRecord.deleteMany({ where: { candidateId } }),
    ...(records.length > 0
      ? [prisma.votingRecord.createMany({ data: records })]
      : []),
    prisma.candidate.update({
      where: { id: candidateId },
      data: {
        lastRefreshedAt: new Date(),
        dataIsStale: false,
        hasLimitedData: records.length === 0,
      },
    }),
  ]);

  console.log(`[votingRecord] stored ${records.length} records for "${candidate.fullName}"`);
}
