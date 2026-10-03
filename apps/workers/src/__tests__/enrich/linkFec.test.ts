/**
 * linkFec.ts tests (ADR-008 Slice 4)
 *
 * Covers:
 *  - fecRaceFor(): OCD-ID + district type → FEC state/office/district
 *  - linkFecIds(): queries FEC per race, links exact matches, records incumbency
 *  - Loose matches need confirmation; confirmed ones link
 *  - Unmatched and ambiguous candidates are reported, never linked
 *  - Existing links: kept while valid, removed when stale
 *  - An FEC ID claimed by two candidates in one race links to neither
 *  - Holders from earlier elections or withdrawn holders give up an FEC ID;
 *    an active holder in the same election keeps it
 *  - A failing race is reported without stopping the others
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
  election: { findMany: vi.fn() },
  externalRef: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  candidate: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../../lib/db.js", () => ({ prisma: mockDb }));

const mockFec = vi.hoisted(() => ({ listRaceCandidates: vi.fn() }));
vi.mock("../../lib/fec.js", () => mockFec);

const mockConfirmed = vi.hoisted(() => ({ confirmedFecId: vi.fn() }));
vi.mock("../../enrich/fecConfirmedLinks.js", () => mockConfirmed);

import { fecRaceFor, linkFecIds } from "../../enrich/linkFec.js";
import type { FecRaceCandidate } from "../../lib/fec.js";

const NOW = new Date("2026-10-04T10:00:00Z");
const ELECTION_DATE = new Date("2026-11-03");
const NC1 = "U.S. House — North Carolina District 1";

function filer(name: string, id: string, overrides: Partial<FecRaceCandidate> = {}): FecRaceCandidate {
  return {
    candidate_id: id,
    name,
    party: "DEM",
    state: "NC",
    district: "01",
    office: "H",
    cycles: [2026],
    incumbent_challenge: "C",
    has_raised_funds: true,
    last_file_date: "2026-01-01",
    ...overrides,
  };
}

function houseElection(candidates: { id: string; fullName: string }[], district = 1) {
  return {
    id: `e-nc${district}`,
    electionDate: ELECTION_DATE,
    district: {
      ocdId: `ocd-division/country:us/state:nc/cd:${district}`,
      districtType: "congressional",
      name: `U.S. House — North Carolina District ${district}`,
    },
    candidates,
  };
}

describe("fecRaceFor", () => {
  it("maps a congressional district to a two-digit FEC House district", () => {
    expect(fecRaceFor("ocd-division/country:us/state:nc/cd:1", "congressional")).toEqual({
      state: "NC",
      office: "H",
      district: "01",
    });
    expect(fecRaceFor("ocd-division/country:us/state:nc/cd:13", "congressional")?.district).toBe("13");
  });

  it("maps a state to a Senate race with no district", () => {
    expect(fecRaceFor("ocd-division/country:us/state:nc", "senate")).toEqual({ state: "NC", office: "S" });
  });

  it("uses district 00 for an at-large House seat", () => {
    expect(fecRaceFor("ocd-division/country:us/state:wy", "congressional")?.district).toBe("00");
  });

  it("returns null for state legislative and statewide races", () => {
    expect(fecRaceFor("ocd-division/country:us/state:nc/sldl:8", "state_house")).toBeNull();
    expect(fecRaceFor("ocd-division/country:us/state:nc/sldu:8", "state_senate")).toBeNull();
    expect(fecRaceFor("ocd-division/country:us/state:nc", "statewide")).toBeNull();
  });
});

describe("linkFecIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.externalRef.findMany.mockResolvedValue([]);
    mockDb.externalRef.findUnique.mockResolvedValue(null);
    mockDb.$transaction.mockResolvedValue([]);
    mockConfirmed.confirmedFecId.mockReturnValue(undefined);
  });

  it("queries the FEC for the exact race and links the exact match", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-davis", fullName: "Don Davis" }])]);
    mockFec.listRaceCandidates.mockResolvedValue([
      filer("DAVIS, DON", "H2NC02287", { incumbent_challenge: "I" }),
      filer("HANIG, BOBBY", "H6NC01001", { party: "REP" }), // primary loser: listed, never linked
    ]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(mockFec.listRaceCandidates).toHaveBeenCalledWith({
      electionYear: 2026,
      state: "NC",
      office: "H",
      district: "01",
    });
    expect(mockDb.externalRef.create).toHaveBeenCalledWith({
      data: { entityType: "candidate", entityId: "c-davis", source: "fec", externalId: "H2NC02287", lastSeenAt: NOW },
    });
    expect(mockDb.candidate.update).toHaveBeenCalledWith({ where: { id: "c-davis" }, data: { isIncumbent: true } });
    expect(stats.linked).toBe(1);
    expect(stats.races).toBe(1);
  });

  it("only considers federal, upcoming elections on the date, with active candidates", async () => {
    mockDb.election.findMany.mockResolvedValue([]);

    await linkFecIds("2026-11-03", NOW);

    expect(mockDb.election.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          electionDate: new Date("2026-11-03"),
          status: { in: ["upcoming", "active"] },
          district: { level: "federal" },
        },
        include: { district: true, candidates: { where: { status: "active" } } },
      })
    );
  });

  it("does not link a loose match without confirmation", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-greg", fullName: "Greg Murphy" }], 3)]);
    mockFec.listRaceCandidates.mockResolvedValue([filer("MURPHY, GREGORY FRANCIS DR.", "H0NC03172")]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(stats.needsConfirmation).toEqual(["Greg Murphy (U.S. House — North Carolina District 3): H0NC03172"]);
    expect(stats.linked).toBe(0);
    expect(mockDb.externalRef.create).not.toHaveBeenCalled();
  });

  it("links a loose match a person has confirmed", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-greg", fullName: "Greg Murphy" }], 3)]);
    mockFec.listRaceCandidates.mockResolvedValue([filer("MURPHY, GREGORY FRANCIS DR.", "H0NC03172")]);
    mockConfirmed.confirmedFecId.mockReturnValue("H0NC03172");

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(mockConfirmed.confirmedFecId).toHaveBeenCalledWith("ocd-division/country:us/state:nc/cd:3", "Greg Murphy");
    expect(stats.linked).toBe(1);
  });

  it("reports unmatched and ambiguous candidates without linking them", async () => {
    mockDb.election.findMany.mockResolvedValue([
      houseElection([
        { id: "c-bo", fullName: "Bo Whitehead" },
        { id: "c-gavin", fullName: "Gavin Solomon" },
      ]),
    ]);
    mockFec.listRaceCandidates.mockResolvedValue([
      filer("WHITEHEAD, ROBERT W MR.", "H1"),
      filer("SOLOMON, GAVIN", "H2"),
      filer("SOLOMON, GAVIN", "H3"),
    ]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(stats.unmatched).toEqual([`Bo Whitehead (${NC1})`]);
    expect(stats.ambiguous).toEqual([`Gavin Solomon (${NC1}): H2, H3`]);
    expect(stats.linked).toBe(0);
    expect(mockDb.externalRef.create).not.toHaveBeenCalled();
  });

  it("keeps a valid existing link and refreshes incumbency from it", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-davis", fullName: "Don Davis" }])]);
    mockDb.externalRef.findMany.mockResolvedValue([{ id: "ref-1", entityId: "c-davis", externalId: "H2NC02287" }]);
    mockFec.listRaceCandidates.mockResolvedValue([filer("DAVIS, DON", "H2NC02287", { incumbent_challenge: "I" })]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(stats.alreadyLinked).toBe(1);
    expect(mockDb.externalRef.update).toHaveBeenCalledWith({ where: { id: "ref-1" }, data: { lastSeenAt: NOW } });
    expect(mockDb.candidate.update).toHaveBeenCalledWith({ where: { id: "c-davis" }, data: { isIncumbent: true } });
    expect(mockDb.externalRef.delete).not.toHaveBeenCalled();
    expect(mockDb.externalRef.create).not.toHaveBeenCalled();
  });

  it("removes a link whose FEC ID the race no longer lists", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-davis", fullName: "Don Davis" }])]);
    mockDb.externalRef.findMany.mockResolvedValue([{ id: "ref-1", entityId: "c-davis", externalId: "H9NC99999" }]);
    mockFec.listRaceCandidates.mockResolvedValue([filer("BUCKHOUT, LAURIE", "H4NC01137")]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(mockDb.externalRef.delete).toHaveBeenCalledWith({ where: { id: "ref-1" } });
    expect(stats.unlinkedStale).toEqual([`Don Davis (${NC1}): H9NC99999`]);
    expect(stats.unmatched).toEqual([`Don Davis (${NC1})`]);
  });

  it("removes a link when the ballot name no longer matches it", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-1", fullName: "Donna Davis" }])]);
    mockDb.externalRef.findMany.mockResolvedValue([{ id: "ref-1", entityId: "c-1", externalId: "H2NC02287" }]);
    mockFec.listRaceCandidates.mockResolvedValue([filer("DAVIS, DON", "H2NC02287")]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(mockDb.externalRef.delete).toHaveBeenCalledWith({ where: { id: "ref-1" } });
    expect(stats.unlinkedStale).toHaveLength(1);
    expect(stats.linked).toBe(0);
  });

  it("links neither candidate when two claim the same FEC ID", async () => {
    mockDb.election.findMany.mockResolvedValue([
      houseElection([
        { id: "c-a", fullName: "Don Davis" },
        { id: "c-b", fullName: "Don Davis Jr." },
      ]),
    ]);
    mockFec.listRaceCandidates.mockResolvedValue([filer("DAVIS, DON", "H2NC02287")]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(stats.linked).toBe(0);
    expect(stats.ambiguous).toHaveLength(2);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("moves an FEC ID from a withdrawn candidate record to the active one", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-new", fullName: "Don Davis" }])]);
    mockFec.listRaceCandidates.mockResolvedValue([filer("DAVIS, DON", "H2NC02287")]);
    mockDb.externalRef.findUnique.mockResolvedValue({ id: "ref-old", entityId: "c-old", externalId: "H2NC02287" });
    mockDb.candidate.findUnique.mockResolvedValue({
      id: "c-old",
      fullName: "Donald Davis",
      status: "withdrawn",
      election: { electionDate: ELECTION_DATE },
    });

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(mockDb.externalRef.update).toHaveBeenCalledWith({
      where: { id: "ref-old" },
      data: { entityId: "c-new", lastSeenAt: NOW },
    });
    expect(stats.linked).toBe(1);
  });

  it("moves an FEC ID from a candidate in an earlier election", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-2026", fullName: "Don Davis" }])]);
    mockFec.listRaceCandidates.mockResolvedValue([filer("DAVIS, DON", "H2NC02287")]);
    mockDb.externalRef.findUnique.mockResolvedValue({ id: "ref-old", entityId: "c-2024", externalId: "H2NC02287" });
    mockDb.candidate.findUnique.mockResolvedValue({
      id: "c-2024",
      fullName: "Don Davis",
      status: "elected",
      election: { electionDate: new Date("2024-11-05") },
    });

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(stats.linked).toBe(1);
    expect(mockDb.externalRef.update).toHaveBeenCalledWith({
      where: { id: "ref-old" },
      data: { entityId: "c-2026", lastSeenAt: NOW },
    });
  });

  it("does not take an FEC ID from an active candidate in the same election", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-new", fullName: "Don Davis" }])]);
    mockFec.listRaceCandidates.mockResolvedValue([filer("DAVIS, DON", "H2NC02287")]);
    mockDb.externalRef.findUnique.mockResolvedValue({ id: "ref-old", entityId: "c-other", externalId: "H2NC02287" });
    mockDb.candidate.findUnique.mockResolvedValue({
      id: "c-other",
      fullName: "Don Davis",
      status: "active",
      election: { electionDate: ELECTION_DATE },
    });

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(stats.linked).toBe(0);
    expect(stats.ambiguous).toEqual([`Don Davis (${NC1}): H2NC02287 already linked to "Don Davis"`]);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("reports a failing race and continues with the next", async () => {
    mockDb.election.findMany.mockResolvedValue([
      houseElection([{ id: "c-davis", fullName: "Don Davis" }], 1),
      houseElection([{ id: "c-ross", fullName: "Deborah Ross" }], 2),
    ]);
    mockFec.listRaceCandidates
      .mockRejectedValueOnce(new Error("Request failed with status code 503"))
      .mockResolvedValueOnce([filer("ROSS, DEBORAH", "H0NC02125")]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(stats.failedRaces).toEqual([`${NC1}: Request failed with status code 503`]);
    expect(stats.linked).toBe(1);
  });

  it("treats an empty FEC response as a failure and unlinks nothing", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([{ id: "c-davis", fullName: "Don Davis" }])]);
    mockFec.listRaceCandidates.mockResolvedValue([]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(stats.failedRaces).toEqual([`${NC1}: FEC returned no filers for this race`]);
    expect(mockDb.externalRef.delete).not.toHaveBeenCalled();
  });

  it("skips races with no active candidates without calling the FEC", async () => {
    mockDb.election.findMany.mockResolvedValue([houseElection([])]);

    const stats = await linkFecIds("2026-11-03", NOW);

    expect(stats.races).toBe(0);
    expect(mockFec.listRaceCandidates).not.toHaveBeenCalled();
  });
});
