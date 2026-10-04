/**
 * congress.ts tests
 *
 * Covers:
 *  - getCurrentCongressSession(): pure date math (Priority 1)
 *  - findMemberByName(): mocked axios (Priority 2)
 *  - getHouseVoteList(): mocked axios (Priority 2)
 *  - getHouseVoteMemberPositions(): mocked axios (Priority 2)
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

import {
  getCurrentCongressSession,
  findMemberByName,
  getHouseVoteList,
  getHouseVoteMemberPositions,
  type CongressMember,
} from "../../lib/congress.js";

// ── Helper factories ──────────────────────────────────────────────────────────

function makeHouseMember(
  bioguideId: string,
  name: string, // "Last, First" format
  state = "TN"
): CongressMember {
  return {
    bioguideId,
    name,
    partyName: "Democratic",
    state,
    district: 9,
    terms: {
      item: [{ chamber: "House of Representatives", startYear: 2023 }],
    },
  };
}

function makeSenateMember(bioguideId: string, name: string, state = "TN"): CongressMember {
  return {
    bioguideId,
    name,
    partyName: "Republican",
    state,
    terms: {
      item: [{ chamber: "Senate", startYear: 2021 }],
    },
  };
}

// ── getCurrentCongressSession — pure date math ────────────────────────────────
// The formula: congress = floor((year - 1789) / 2) + 1; session = year % 2 === 1 ? 1 : 2
describe("getCurrentCongressSession", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns congress 119 session 1 for year 2025 (odd year, new congress)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
    expect(getCurrentCongressSession()).toEqual({ congress: 119, session: 1 });
  });

  it("returns congress 119 session 2 for year 2026 (even year, same congress)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
    expect(getCurrentCongressSession()).toEqual({ congress: 119, session: 2 });
  });

  it("returns congress 118 session 2 for year 2024", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-11-05T12:00:00Z"));
    expect(getCurrentCongressSession()).toEqual({ congress: 118, session: 2 });
  });

  it("returns congress 118 session 1 for year 2023", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-03-20T12:00:00Z"));
    expect(getCurrentCongressSession()).toEqual({ congress: 118, session: 1 });
  });

  it("returns congress 1 session 1 for year 1789 (boundary)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("1789-03-04T12:00:00Z"));
    expect(getCurrentCongressSession()).toEqual({ congress: 1, session: 1 });
  });
});

// ── findMemberByName — mocked axios ─────────────────────────────────────────
describe("findMemberByName", () => {
  beforeEach(() => {
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get });
    axiosMocks.get.mockReset();
  });

  function mockMemberList(members: CongressMember[]) {
    axiosMocks.get.mockResolvedValue({
      data: {
        members,
        pagination: { count: members.length, total: members.length },
      },
    });
  }

  it("returns member on exact last name + first name prefix match", async () => {
    const member = makeHouseMember("D000191", "DeFazio, Peter");
    mockMemberList([member]);

    const result = await findMemberByName("Peter DeFazio", "house");
    expect(result?.bioguideId).toBe("D000191");
  });

  it("handles last-name-only fallback when first name does not match", async () => {
    const member = makeHouseMember("S000185", "Scott, Robert");
    mockMemberList([member]);

    // "Bobby" does not start with "robert" and "robert" does not start with "bobby"
    // Falls through to Pass 2 (last-name-only)
    const result = await findMemberByName("Bobby Scott", "house");
    expect(result?.bioguideId).toBe("S000185");
  });

  it("falls back to last-name-only match for nicknames like Chuck (does not match Charles via prefix)", async () => {
    // "Charles".startsWith("chuck") → false; "chuck".startsWith("charles") → false
    // Neither pass-1 prefix check matches, so it falls to pass-2 (last-name-only)
    const member = makeSenateMember("S000250", "Schumer, Charles");
    mockMemberList([member]);

    const result = await findMemberByName("Chuck Schumer", "senate");
    // Pass 2 (last-name-only) succeeds
    expect(result?.bioguideId).toBe("S000250");
  });

  it("filters to the requested chamber (house vs senate)", async () => {
    const houseMember = makeHouseMember("H000001", "Harris, Andy");
    const senateMember = makeSenateMember("H000002", "Harris, Kamala");
    mockMemberList([houseMember, senateMember]);

    const houseResult = await findMemberByName("Andy Harris", "house");
    expect(houseResult?.bioguideId).toBe("H000001");

    // Reset for second call
    axiosMocks.get.mockResolvedValue({
      data: {
        members: [houseMember, senateMember],
        pagination: { count: 2, total: 2 },
      },
    });

    const senateResult = await findMemberByName("Kamala Harris", "senate");
    expect(senateResult?.bioguideId).toBe("H000002");
  });

  it("returns null when no member matches", async () => {
    mockMemberList([makeHouseMember("D000191", "DeFazio, Peter")]);

    const result = await findMemberByName("Unknown Person", "house");
    expect(result).toBeNull();
  });

  it("returns null when chamber has no matching members", async () => {
    const senateMember = makeSenateMember("C000141", "Cardin, Benjamin");
    mockMemberList([senateMember]);

    // Searching for this senator in the house chamber should find nothing
    const result = await findMemberByName("Benjamin Cardin", "house");
    expect(result).toBeNull();
  });
});

// ── getHouseVoteList — mocked axios ──────────────────────────────────────────
describe("getHouseVoteList", () => {
  beforeEach(() => {
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get });
    axiosMocks.get.mockReset();
  });

  it("returns the list of roll call votes on success", async () => {
    const fakeVotes = [
      {
        rollCallNumber: 42,
        sessionNumber: 1,
        congress: 119,
        startDate: "2025-03-01T14:00:00Z",
        result: "Passed",
        legislationNumber: "1234",
        legislationType: "H.R.",
        sourceDataURL: "https://clerk.house.gov/xml/vote/2025/1234.xml",
        url: "https://api.congress.gov/v3/house-vote/119/1/42",
      },
    ];

    axiosMocks.get.mockResolvedValue({
      data: { houseRollCallVotes: fakeVotes },
    });

    const result = await getHouseVoteList(119, 1, 50);
    expect(result).toEqual(fakeVotes);
  });

  it("returns empty array when houseRollCallVotes is missing", async () => {
    axiosMocks.get.mockResolvedValue({ data: {} });

    const result = await getHouseVoteList(119, 1, 50);
    expect(result).toEqual([]);
  });

  it("returns empty array on any HTTP error with a response (including 404)", async () => {
    axiosMocks.get.mockRejectedValue({ response: { status: 404 } });

    const result = await getHouseVoteList(119, 1, 50);
    expect(result).toEqual([]);
  });

  it("returns empty array on 500 HTTP error", async () => {
    axiosMocks.get.mockRejectedValue({ response: { status: 500 } });

    const result = await getHouseVoteList(119, 1, 50);
    expect(result).toEqual([]);
  });

  it("re-throws network errors that have no response", async () => {
    const networkError = new Error("Network Error");
    // No .response property — simulates a network/connection failure
    axiosMocks.get.mockRejectedValue(networkError);

    await expect(getHouseVoteList(119, 1, 50)).rejects.toThrow("Network Error");
  });
});

// ── getHouseVoteMemberPositions — mocked axios ───────────────────────────────
describe("getHouseVoteMemberPositions", () => {
  beforeEach(() => {
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get });
    axiosMocks.get.mockReset();
  });

  it("returns the member votes for a roll call", async () => {
    const fakePositions = [
      {
        bioguideID: "D000191",
        firstName: "Peter",
        lastName: "DeFazio",
        voteCast: "Yea",
        voteParty: "D",
        voteState: "OR",
      },
      {
        bioguideID: "N000127",
        firstName: "Richard",
        lastName: "Neal",
        voteCast: "Nay",
        voteParty: "D",
        voteState: "MA",
      },
    ];

    axiosMocks.get.mockResolvedValue({
      data: {
        houseRollCallVoteMemberVotes: {
          congress: 119,
          results: fakePositions,
        },
      },
    });

    const result = await getHouseVoteMemberPositions(119, 1, 42);
    expect(result).toEqual(fakePositions);
  });

  it("returns empty array when member is not in results", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { houseRollCallVoteMemberVotes: { congress: 119, results: [] } },
    });

    const result = await getHouseVoteMemberPositions(119, 1, 42);
    expect(result).toEqual([]);
  });

  it("returns empty array when houseRollCallVoteMemberVotes is missing", async () => {
    axiosMocks.get.mockResolvedValue({ data: {} });

    const result = await getHouseVoteMemberPositions(119, 1, 42);
    expect(result).toEqual([]);
  });

  it("returns empty array on any HTTP error", async () => {
    axiosMocks.get.mockRejectedValue({ response: { status: 404 } });

    const result = await getHouseVoteMemberPositions(119, 1, 99999);
    expect(result).toEqual([]);
  });
});
