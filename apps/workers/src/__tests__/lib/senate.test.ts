import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";

vi.mock("axios");
const mockedAxios = vi.mocked(axios);

import {
  getSenateVoteMenu,
  getSenateVoteMemberPositions,
  senateVoteXmlUrl,
} from "../../lib/senate.js";

const VOTE_MENU_XML = `<?xml version="1.0" encoding="UTF-8"?>
<vote_summary>
  <congress>119</congress>
  <session>1</session>
  <votes>
    <vote>
      <vote_number>1</vote_number>
      <vote_date>January 03, 2025</vote_date>
      <issue>S. 1</issue>
      <question>On the Motion</question>
      <result>Motion Agreed to</result>
      <title>A motion to proceed</title>
    </vote>
    <vote>
      <vote_number>2</vote_number>
      <vote_date>January 04, 2025</vote_date>
      <issue>H.R. 100</issue>
      <question>On Passage</question>
      <result>Passed</result>
      <title>A bill to authorize</title>
    </vote>
    <vote>
      <vote_number>3</vote_number>
      <vote_date>January 05, 2025</vote_date>
      <issue></issue>
      <question>On the Nomination</question>
      <result>Confirmed</result>
      <title>Confirmation of a nominee</title>
    </vote>
  </votes>
</vote_summary>`;

const MEMBER_VOTE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<roll_call_vote>
  <congress>119</congress>
  <session>1</session>
  <vote_number>2</vote_number>
  <members>
    <member>
      <last_name>Smith</last_name>
      <first_name>John</first_name>
      <party>R</party>
      <state>TX</state>
      <vote_cast>Yea</vote_cast>
      <lis_member_id>S001</lis_member_id>
    </member>
    <member>
      <last_name>Jones</last_name>
      <first_name>Mary</first_name>
      <party>D</party>
      <state>CA</state>
      <vote_cast>Nay</vote_cast>
      <lis_member_id>S002</lis_member_id>
    </member>
    <member>
      <last_name>Brown</last_name>
      <first_name>Robert</first_name>
      <party>D</party>
      <state>OH</state>
      <vote_cast>Not Voting</vote_cast>
      <lis_member_id>S003</lis_member_id>
    </member>
  </members>
</roll_call_vote>`;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── senateVoteXmlUrl ──────────────────────────────────────────────────────────

describe("senateVoteXmlUrl", () => {
  it("pads roll number to 5 digits", () => {
    expect(senateVoteXmlUrl(119, 1, 1)).toContain("vote_119_1_00001.xml");
  });

  it("puts the file in the correct folder", () => {
    expect(senateVoteXmlUrl(119, 1, 1)).toContain("/vote1191/");
  });

  it("handles larger roll numbers", () => {
    expect(senateVoteXmlUrl(119, 2, 123)).toContain("vote_119_2_00123.xml");
  });
});

// ── getSenateVoteMenu ─────────────────────────────────────────────────────────

describe("getSenateVoteMenu", () => {
  it("returns votes sorted most-recent first", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: VOTE_MENU_XML });
    const votes = await getSenateVoteMenu(119, 1);
    expect(votes[0].rollNumber).toBe(3);
    expect(votes[1].rollNumber).toBe(2);
    expect(votes[2].rollNumber).toBe(1);
  });

  it("respects the limit parameter", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: VOTE_MENU_XML });
    const votes = await getSenateVoteMenu(119, 1, 2);
    expect(votes).toHaveLength(2);
    expect(votes[0].rollNumber).toBe(3);
  });

  it("parses vote fields correctly", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: VOTE_MENU_XML });
    const votes = await getSenateVoteMenu(119, 1);
    const vote = votes.find((v) => v.rollNumber === 2)!;
    expect(vote.voteDate).toBe("January 04, 2025");
    expect(vote.issue).toBe("H.R. 100");
    expect(vote.question).toBe("On Passage");
    expect(vote.result).toBe("Passed");
    expect(vote.title).toBe("A bill to authorize");
  });

  it("includes the correct sourceUrl", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: VOTE_MENU_XML });
    const votes = await getSenateVoteMenu(119, 1);
    const vote = votes.find((v) => v.rollNumber === 1)!;
    expect(vote.sourceUrl).toContain("vote_119_1_00001.xml");
  });

  it("returns empty array on 404", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 404 } });
    const votes = await getSenateVoteMenu(119, 1);
    expect(votes).toEqual([]);
  });

  it("rethrows non-404 HTTP errors", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 500 } });
    await expect(getSenateVoteMenu(119, 1)).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("rethrows network errors", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue(new Error("Network Error"));
    await expect(getSenateVoteMenu(119, 1)).rejects.toThrow("Network Error");
  });
});

// ── getSenateVoteMemberPositions ──────────────────────────────────────────────

describe("getSenateVoteMemberPositions", () => {
  it("parses all members from XML", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: MEMBER_VOTE_XML });
    const members = await getSenateVoteMemberPositions(119, 1, 2);
    expect(members).toHaveLength(3);
  });

  it("parses member fields correctly", async () => {
    mockedAxios.get = vi.fn().mockResolvedValue({ data: MEMBER_VOTE_XML });
    const members = await getSenateVoteMemberPositions(119, 1, 2);
    const smith = members.find((m) => m.lastName === "Smith")!;
    expect(smith.firstName).toBe("John");
    expect(smith.party).toBe("R");
    expect(smith.state).toBe("TX");
    expect(smith.voteCast).toBe("Yea");
    expect(smith.lisMemberId).toBe("S001");
  });

  it("returns empty array on 404", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 404 } });
    const members = await getSenateVoteMemberPositions(119, 1, 999);
    expect(members).toEqual([]);
  });

  it("rethrows non-404 errors", async () => {
    mockedAxios.get = vi.fn().mockRejectedValue({ response: { status: 503 } });
    await expect(getSenateVoteMemberPositions(119, 1, 2)).rejects.toMatchObject({ response: { status: 503 } });
  });
});
