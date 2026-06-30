/**
 * votingRecord.ts tests
 *
 * Covers:
 *  - mapVoteCast(): position string → VoteChoice enum (Priority 1)
 *  - toRecords(): VoteWithPosition[] → DB record shape (Priority 1)
 *  - scrapeVotingRecord(): full orchestration with mocked db + congress (Priority 2)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => ({
  candidate: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  votingRecord: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  $transaction: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/db.js", () => ({ prisma: mockDb }));

// ── Congress API mock ─────────────────────────────────────────────────────────
const mockCongress = vi.hoisted(() => ({
  findMemberByName: vi.fn(),
  getHouseVoteList: vi.fn().mockResolvedValue([]),
  getHouseVoteMemberPositions: vi.fn().mockResolvedValue([]),
  getCurrentCongressSession: vi.fn().mockReturnValue({ congress: 119, session: 1 }),
}));

vi.mock("../../lib/congress.js", () => mockCongress);

import {
  scrapeVotingRecord,
  mapVoteCast,
  toRecords,
  type VoteWithPosition,
} from "../../scrapers/votingRecord.js";
import type { HouseRollCallVote, HouseMemberVote } from "../../lib/congress.js";

// ── Helper: build a minimal candidate object as Prisma would return it ────────
function makeFederalHouseCandidate(id = "cand-house-1") {
  return {
    id,
    fullName: "Jane Doe",
    hasLimitedData: false,
    election: {
      district: {
        level: "federal",
        districtType: "Congressional District",
        jurisdiction: { id: "jur-1", name: "United States" },
      },
    },
  };
}

function makeStateLevelCandidate(id = "cand-state-1") {
  return {
    id,
    fullName: "Bob Smith",
    hasLimitedData: false,
    election: {
      district: {
        level: "state",
        districtType: "State House",
        jurisdiction: { id: "jur-2", name: "Tennessee" },
      },
    },
  };
}

function makeFederalSenateCandidate(id = "cand-senate-1") {
  return {
    id,
    fullName: "Mary Johnson",
    hasLimitedData: false,
    election: {
      district: {
        level: "federal",
        districtType: "US Senate",
        jurisdiction: { id: "jur-1", name: "United States" },
      },
    },
  };
}

function makeVote(overrides: Partial<HouseRollCallVote> = {}): HouseRollCallVote {
  return {
    rollCallNumber: 1,
    sessionNumber: 1,
    congress: 119,
    startDate: "2025-03-01T14:00:00Z",
    result: "Passed",
    legislationNumber: "1234",
    legislationType: "H.R.",
    sourceDataURL: "https://clerk.house.gov/xml/vote/2025/1234.xml",
    url: "https://api.congress.gov/v3/house-vote/119/1/1",
    ...overrides,
  };
}

function makeMemberVote(voteCast: string, bioguideID = "D000191"): HouseMemberVote {
  return {
    bioguideID,
    firstName: "Jane",
    lastName: "Doe",
    voteCast,
    voteParty: "D",
    voteState: "TN",
  };
}

// ── mapVoteCast — pure function ───────────────────────────────────────────────
describe("mapVoteCast", () => {
  it('maps "Yea" to "yea"', () => {
    expect(mapVoteCast("Yea")).toBe("yea");
  });

  it('maps "Aye" to "yea" (synonym)', () => {
    expect(mapVoteCast("Aye")).toBe("yea");
  });

  it('maps "Nay" to "nay"', () => {
    expect(mapVoteCast("Nay")).toBe("nay");
  });

  it('maps "No" to "nay" (synonym)', () => {
    expect(mapVoteCast("No")).toBe("nay");
  });

  it('maps "Present" to "present"', () => {
    expect(mapVoteCast("Present")).toBe("present");
  });

  it('maps "Not Voting" to "absent"', () => {
    expect(mapVoteCast("Not Voting")).toBe("absent");
  });

  it('returns null for "Speaker" (procedural, not a vote position)', () => {
    expect(mapVoteCast("Speaker")).toBeNull();
  });

  it("returns null for an unrecognised string", () => {
    expect(mapVoteCast("Abstain")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(mapVoteCast("YEA")).toBe("yea");
    expect(mapVoteCast("nay")).toBe("nay");
    expect(mapVoteCast("NOT VOTING")).toBe("absent");
  });
});

// ── toRecords — pure transformation ──────────────────────────────────────────
describe("toRecords", () => {
  it("maps a Yea vote to the correct record shape", () => {
    const history: VoteWithPosition[] = [
      { vote: makeVote({ rollCallNumber: 42 }), memberVote: makeMemberVote("Yea") },
    ];

    const records = toRecords(history, "cand-1");

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      candidateId: "cand-1",
      vote: "yea",
      sourceAvailable: true,
      sourceUrl: "https://clerk.house.gov/xml/vote/2025/1234.xml",
    });
  });

  it("includes a unique key prefix containing congress and roll call number", () => {
    const history: VoteWithPosition[] = [
      { vote: makeVote({ rollCallNumber: 7, congress: 119 }), memberVote: makeMemberVote("Nay") },
    ];

    const records = toRecords(history, "cand-1");
    expect(records[0].billOrMeasure).toMatch(/\[119-H-7\]/);
  });

  it("includes legislation number in the bill label when present", () => {
    const history: VoteWithPosition[] = [
      {
        vote: makeVote({ legislationNumber: "4321", legislationType: "S." }),
        memberVote: makeMemberVote("Yea"),
      },
    ];

    const records = toRecords(history, "cand-1");
    expect(records[0].billOrMeasure).toContain("S. 4321");
  });

  it("falls back to Roll Call label when legislation number is absent", () => {
    const history: VoteWithPosition[] = [
      {
        vote: makeVote({ rollCallNumber: 99, legislationNumber: undefined }),
        memberVote: makeMemberVote("Present"),
      },
    ];

    const records = toRecords(history, "cand-1");
    expect(records[0].billOrMeasure).toContain("Roll Call 99");
  });

  it("excludes entries where mapVoteCast returns null (e.g. Speaker)", () => {
    const history: VoteWithPosition[] = [
      { vote: makeVote(), memberVote: makeMemberVote("Speaker") },
      { vote: makeVote({ rollCallNumber: 2 }), memberVote: makeMemberVote("Nay") },
    ];

    const records = toRecords(history, "cand-1");
    expect(records).toHaveLength(1);
    expect(records[0].vote).toBe("nay");
  });

  it("excludes entries with an invalid startDate", () => {
    const badVote = makeVote({ startDate: "not-a-date" });
    const history: VoteWithPosition[] = [
      { vote: badVote, memberVote: makeMemberVote("Yea") },
    ];

    const records = toRecords(history, "cand-1");
    expect(records).toHaveLength(0);
  });

  it("returns an empty array when voteHistory is empty", () => {
    expect(toRecords([], "cand-1")).toEqual([]);
  });

  it("parses startDate into a Date object", () => {
    const history: VoteWithPosition[] = [
      { vote: makeVote({ startDate: "2025-03-15T00:00:00Z" }), memberVote: makeMemberVote("Yea") },
    ];

    const records = toRecords(history, "cand-1");
    expect(records[0].voteDate).toBeInstanceOf(Date);
    expect(records[0].voteDate.getFullYear()).toBe(2025);
  });
});

// ── scrapeVotingRecord — orchestration with mocked I/O ───────────────────────
describe("scrapeVotingRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockResolvedValue([]);
    mockCongress.getCurrentCongressSession.mockReturnValue({ congress: 119, session: 1 });
    mockCongress.getHouseVoteList.mockResolvedValue([]);
    mockCongress.getHouseVoteMemberPositions.mockResolvedValue([]);
  });

  it("returns early without touching Congress API for a non-federal candidate", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeStateLevelCandidate());

    await scrapeVotingRecord("cand-state-1");

    expect(mockCongress.findMemberByName).not.toHaveBeenCalled();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("marks a Senate candidate as hasLimitedData and returns early", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalSenateCandidate());
    mockDb.candidate.update.mockResolvedValue({});

    await scrapeVotingRecord("cand-senate-1");

    expect(mockCongress.findMemberByName).not.toHaveBeenCalled();
    expect(mockDb.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasLimitedData: true }),
      })
    );
  });

  it("returns early and does nothing when the candidate does not exist in the DB", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(null);

    await scrapeVotingRecord("nonexistent-id");

    expect(mockCongress.findMemberByName).not.toHaveBeenCalled();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("sets hasLimitedData when no Congress.gov member is found", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockCongress.findMemberByName.mockResolvedValue(null);
    mockDb.candidate.update.mockResolvedValue({});

    await scrapeVotingRecord("cand-house-1");

    expect(mockDb.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasLimitedData: true }),
      })
    );
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("runs a transaction with deleteMany + createMany + update when votes are found", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockCongress.findMemberByName.mockResolvedValue({
      bioguideId: "D000191",
      name: "Doe, Jane",
    });

    const vote = makeVote({ rollCallNumber: 1, congress: 119 });
    mockCongress.getHouseVoteList.mockResolvedValue([vote]);
    mockCongress.getHouseVoteMemberPositions.mockResolvedValue([
      makeMemberVote("Yea", "D000191"),
    ]);

    await scrapeVotingRecord("cand-house-1");

    expect(mockDb.votingRecord.deleteMany).toHaveBeenCalledWith({
      where: { candidateId: "cand-house-1" },
    });
    expect(mockDb.votingRecord.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ candidateId: "cand-house-1", vote: "yea" }),
        ]),
      })
    );
    expect(mockDb.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cand-house-1" },
        data: expect.objectContaining({
          dataIsStale: false,
          hasLimitedData: false,
        }),
      })
    );
    expect(mockDb.$transaction).toHaveBeenCalled();
  });

  it("runs a transaction without createMany when no votes are found for the member", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockCongress.findMemberByName.mockResolvedValue({
      bioguideId: "D000191",
      name: "Doe, Jane",
    });

    // Vote list has one entry, but member was NOT in the positions list
    const vote = makeVote({ rollCallNumber: 1 });
    mockCongress.getHouseVoteList.mockResolvedValue([vote]);
    mockCongress.getHouseVoteMemberPositions.mockResolvedValue([]); // member not in this vote

    await scrapeVotingRecord("cand-house-1");

    expect(mockDb.votingRecord.deleteMany).toHaveBeenCalled();
    expect(mockDb.votingRecord.createMany).not.toHaveBeenCalled();
    expect(mockDb.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasLimitedData: true }),
      })
    );
  });

  it("looks up the member by chamber 'house' for a Congressional District", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeFederalHouseCandidate());
    mockCongress.findMemberByName.mockResolvedValue(null);
    mockDb.candidate.update.mockResolvedValue({});

    await scrapeVotingRecord("cand-house-1");

    expect(mockCongress.findMemberByName).toHaveBeenCalledWith("Jane Doe", "house");
  });
});
