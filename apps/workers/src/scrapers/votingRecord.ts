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

// Only roll call / recorded votes identify individual members.
// Voice votes and division votes do not — those are excluded by the API.
const RECENT_VOTES_LIMIT = 50;

function mapVoteCast(voteCast: string): VoteChoice | null {
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

interface VoteWithPosition {
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

function toRecords(
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

  if (chamber === "senate") {
    // Senate roll call votes require Senate.gov XML parsing — not yet implemented.
    // BullMQ will not retry this as a failure; mark limited data for now.
    console.warn(
      `[votingRecord] Senate voting records not yet implemented for "${candidate.fullName}"`
    );
    await prisma.candidate.update({
      where: { id: candidateId },
      data: { hasLimitedData: true, lastRefreshedAt: new Date() },
    });
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

  const { congress, session } = getCurrentCongressSession();

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
