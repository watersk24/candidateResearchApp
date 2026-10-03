/**
 * ingestRaces tests (ADR-008)
 *
 * Covers:
 *  - candidateSlug() / electionStatus() helpers
 *  - First import: creates jurisdictions (parent chain), districts, elections,
 *    candidates, and ExternalRefs
 *  - Re-import: updates existing rows via ExternalRef, touches lastSeenAt,
 *    reinstates withdrawn candidates without overwriting other statuses
 *  - Orphaned refs (entity deleted) are removed and the entity recreated
 *  - Withdrawals: only active candidates on the election date, only this
 *    source's stale refs; mass-withdrawal guard and --force
 *  - Elections no longer listed by the source are retired
 *  - Empty provider result aborts before anything is withdrawn
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const mockDb = vi.hoisted(() => {
  const db = {
    jurisdiction: { upsert: vi.fn() },
    district: { upsert: vi.fn() },
    election: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    candidate: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    externalRef: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  };
  return db;
});

vi.mock("../../lib/db.js", () => ({ prisma: mockDb }));

import { ingestRaces, candidateSlug, electionStatus } from "../../ingest/ingestRaces.js";
import type { NormalizedRace, RaceDataProvider } from "../../ingest/types.js";

const NOW = new Date("2026-10-03T12:00:00Z");
const ELECTION_DAY = new Date("2026-11-03");

const US = { ocdId: "ocd-division/country:us", name: "United States", type: "federal" as const };
const NC = { ocdId: "ocd-division/country:us/state:nc", name: "North Carolina", type: "state" as const, parent: US };

function senateRace(candidateNames = ["Jane Doe"]): NormalizedRace {
  return {
    externalId: "2026-11-03|US SENATE",
    name: "US Senate",
    electionDate: "2026-11-03",
    electionType: "general",
    district: {
      ocdId: NC.ocdId,
      districtType: "senate",
      level: "federal",
      name: "U.S. Senate — North Carolina",
      jurisdiction: US,
    },
    candidates: candidateNames.map((n) => ({
      externalId: `2026-11-03|US SENATE|${n}`,
      fullName: n,
      party: "Democrat",
    })),
  };
}

function sheriffRace(): NormalizedRace {
  const pitt = { ocdId: `${NC.ocdId}/county:pitt`, name: "Pitt County", type: "county" as const, parent: NC };
  return {
    externalId: "2026-11-03|PITT COUNTY SHERIFF",
    name: "Pitt County Sheriff",
    electionDate: "2026-11-03",
    electionType: "general",
    district: { ocdId: pitt.ocdId, districtType: "county", level: "local", name: "Pitt County", jurisdiction: pitt },
    candidates: [{ externalId: "2026-11-03|PITT COUNTY SHERIFF|Sam Lee", fullName: "Sam Lee", party: null }],
  };
}

function provider(races: NormalizedRace[], unmatchedContests: string[] = []): RaceDataProvider {
  return { source: "ncsbe", listRaces: vi.fn().mockResolvedValue({ races, unmatchedContests, skippedRows: 0 }) };
}

/** Configures which entities exist as active rows and which of them have stale refs. */
function setStale({
  activeCandidates = [] as string[],
  staleCandidates = [] as string[],
  listedElections = [] as string[],
  staleElections = [] as string[],
}) {
  mockDb.candidate.findMany.mockResolvedValue(activeCandidates.map((id) => ({ id })));
  mockDb.election.findMany.mockResolvedValue(listedElections.map((id) => ({ id })));
  mockDb.externalRef.findMany.mockImplementation(({ where }) =>
    Promise.resolve(
      (where.entityType === "candidate" ? staleCandidates : staleElections).map((entityId) => ({ entityId }))
    )
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  // Interactive transactions run the callback against the same mock client
  mockDb.$transaction.mockImplementation((fn: (tx: typeof mockDb) => unknown) => fn(mockDb));
  mockDb.jurisdiction.upsert.mockImplementation(({ where }) => Promise.resolve({ id: `jur:${where.ocdId}` }));
  mockDb.district.upsert.mockImplementation(({ where }) =>
    Promise.resolve({ id: `dist:${where.ocdId_districtType.ocdId}#${where.ocdId_districtType.districtType}` })
  );
  mockDb.election.create.mockResolvedValue({ id: "election-1" });
  mockDb.election.updateMany.mockResolvedValue({ count: 0 });
  mockDb.candidate.create.mockImplementation(({ data }) => Promise.resolve({ id: `cand:${data.fullName}` }));
  mockDb.candidate.updateMany.mockResolvedValue({ count: 0 });
  mockDb.externalRef.findUnique.mockResolvedValue(null);
  setStale({});
});

// ── Helpers ───────────────────────────────────────────────────────────────────

describe("candidateSlug", () => {
  it("builds a readable slug with a stable hash suffix", () => {
    const slug = candidateSlug("Roy Cooper", "2026-11-03|US SENATE|Roy Cooper");
    expect(slug).toMatch(/^roy-cooper-[0-9a-f]{8}$/);
    expect(candidateSlug("Roy Cooper", "2026-11-03|US SENATE|Roy Cooper")).toBe(slug);
  });

  it("gives same-named candidates in different contests different slugs", () => {
    expect(candidateSlug("John Smith", "a|X|John Smith")).not.toBe(candidateSlug("John Smith", "a|Y|John Smith"));
  });

  it("strips punctuation and falls back when nothing is left", () => {
    expect(candidateSlug('Robert "Bob" O\'Neil, Jr.', "ref")).toMatch(/^robert-bob-o-neil-jr-[0-9a-f]{8}$/);
    expect(candidateSlug("!!!", "ref")).toMatch(/^candidate-[0-9a-f]{8}$/);
  });
});

describe("electionStatus", () => {
  it("is upcoming on or before election day and concluded after", () => {
    expect(electionStatus("2026-11-03", NOW)).toBe("upcoming");
    expect(electionStatus("2026-10-03", NOW)).toBe("upcoming");
    expect(electionStatus("2026-03-03", NOW)).toBe("concluded");
  });
});

// ── First import ──────────────────────────────────────────────────────────────

describe("ingestRaces — first import", () => {
  it("creates the jurisdiction chain parent-first", async () => {
    await ingestRaces(provider([sheriffRace()]), { electionDate: "2026-11-03" }, NOW);

    const calls = mockDb.jurisdiction.upsert.mock.calls.map(([args]) => args.where.ocdId);
    expect(calls).toEqual([
      "ocd-division/country:us",
      "ocd-division/country:us/state:nc",
      "ocd-division/country:us/state:nc/county:pitt",
    ]);
    expect(mockDb.jurisdiction.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ parentId: "jur:ocd-division/country:us/state:nc", type: "county" }),
      })
    );
  });

  it("upserts districts by (ocdId, districtType)", async () => {
    await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW);

    expect(mockDb.district.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ocdId_districtType: { ocdId: NC.ocdId, districtType: "senate" } },
        create: expect.objectContaining({ level: "federal", jurisdictionId: "jur:ocd-division/country:us" }),
      })
    );
  });

  it("creates elections and candidates with ExternalRefs", async () => {
    const stats = await ingestRaces(provider([senateRace(["Jane Doe", "John Roe"])]), { electionDate: "2026-11-03" }, NOW);

    expect(mockDb.election.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        districtId: `dist:${NC.ocdId}#senate`,
        name: "US Senate",
        electionType: "general",
        electionDate: ELECTION_DAY,
        electionCycleStart: new Date("2026-01-01"),
        status: "upcoming",
      }),
    });
    expect(mockDb.candidate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        electionId: "election-1",
        fullName: "Jane Doe",
        party: "Democrat",
        status: "active",
        profileSlug: expect.stringMatching(/^jane-doe-[0-9a-f]{8}$/),
      }),
    });
    expect(mockDb.externalRef.create).toHaveBeenCalledWith({
      data: {
        entityType: "candidate",
        entityId: "cand:Jane Doe",
        source: "ncsbe",
        externalId: "2026-11-03|US SENATE|Jane Doe",
        lastSeenAt: NOW,
      },
    });
    expect(stats).toMatchObject({
      races: 1,
      candidatesCreated: 2,
      candidatesUpdated: 0,
      newCandidateIds: ["cand:Jane Doe", "cand:John Roe"],
    });
  });

  it("does not set isIncumbent, leaving it unknown", async () => {
    await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW);
    expect(mockDb.candidate.create.mock.calls[0][0].data).not.toHaveProperty("isIncumbent");
  });

  it("upserts each shared jurisdiction and district only once per run", async () => {
    const second = { ...senateRace(), externalId: "2026-11-03|US SENATE (UNEXPIRED)" };
    await ingestRaces(provider([senateRace(), second]), { electionDate: "2026-11-03" }, NOW);

    expect(mockDb.district.upsert).toHaveBeenCalledTimes(1);
    expect(mockDb.jurisdiction.upsert).toHaveBeenCalledTimes(1);
  });

  it("passes unmatched contests through in the stats", async () => {
    const stats = await ingestRaces(provider([senateRace()], ["DISTRICT ATTORNEY DISTRICT 10"]), { electionDate: "2026-11-03" }, NOW);
    expect(stats.unmatchedContests).toEqual(["DISTRICT ATTORNEY DISTRICT 10"]);
  });
});

// ── Re-import ─────────────────────────────────────────────────────────────────

describe("ingestRaces — re-import", () => {
  beforeEach(() => {
    mockDb.externalRef.findUnique.mockImplementation(({ where }) => {
      const { externalId } = where.source_externalId;
      return Promise.resolve({ id: `ref:${externalId}`, entityId: externalId.endsWith("Jane Doe") ? "cand-existing" : "election-existing" });
    });
  });

  it("updates existing rows instead of creating new ones", async () => {
    const stats = await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW);

    expect(mockDb.election.create).not.toHaveBeenCalled();
    expect(mockDb.candidate.create).not.toHaveBeenCalled();
    expect(mockDb.election.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "election-existing" } })
    );
    expect(mockDb.candidate.update).toHaveBeenCalledWith({
      where: { id: "cand-existing" },
      data: { fullName: "Jane Doe", party: "Democrat", electionId: "election-existing" },
    });
    expect(stats).toMatchObject({ candidatesCreated: 0, candidatesUpdated: 1, newCandidateIds: [] });
  });

  it("touches lastSeenAt on every ref it sees", async () => {
    await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW);

    expect(mockDb.externalRef.update).toHaveBeenCalledWith({
      where: { id: "ref:2026-11-03|US SENATE|Jane Doe" },
      data: { lastSeenAt: NOW },
    });
  });

  it("reinstates a withdrawn candidate without overwriting other statuses", async () => {
    await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW);

    expect(mockDb.candidate.updateMany).toHaveBeenCalledWith({
      where: { id: "cand-existing", status: "withdrawn" },
      data: { status: "active" },
    });
    // The general update never sets status (so "elected" is preserved)
    expect(mockDb.candidate.update.mock.calls[0][0].data).not.toHaveProperty("status");
  });

  it("removes an orphaned ref and recreates the entity when the row was deleted", async () => {
    mockDb.candidate.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record to update not found.", { code: "P2025", clientVersion: "test" })
    );

    const stats = await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW);

    expect(mockDb.externalRef.delete).toHaveBeenCalledWith({ where: { id: "ref:2026-11-03|US SENATE|Jane Doe" } });
    expect(mockDb.candidate.create).toHaveBeenCalledTimes(1);
    expect(stats.candidatesCreated).toBe(1);
  });

  it("does not swallow other database errors", async () => {
    mockDb.candidate.update.mockRejectedValue(new Error("connection lost"));
    await expect(ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW)).rejects.toThrow("connection lost");
    expect(mockDb.externalRef.delete).not.toHaveBeenCalled();
  });
});

// ── Withdrawals and retirements ───────────────────────────────────────────────

describe("ingestRaces — withdrawals", () => {
  it("starts from active candidates on the election date and withdraws only stale ones", async () => {
    setStale({ activeCandidates: ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "cand-gone"], staleCandidates: ["cand-gone"] });
    mockDb.candidate.updateMany.mockResolvedValue({ count: 1 });

    const stats = await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW);

    expect(mockDb.candidate.findMany).toHaveBeenCalledWith({
      where: { status: "active", election: { electionDate: ELECTION_DAY } },
      select: { id: true },
    });
    expect(mockDb.externalRef.findMany).toHaveBeenCalledWith({
      where: {
        source: "ncsbe",
        entityType: "candidate",
        entityId: { in: expect.arrayContaining(["cand-gone", "c1"]) },
        lastSeenAt: { lt: NOW },
      },
      select: { entityId: true },
    });
    // Only "active" — an "elected" candidate is never flipped to withdrawn
    expect(mockDb.candidate.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["cand-gone"] }, status: "active" },
      data: { status: "withdrawn" },
    });
    expect(stats.candidatesWithdrawn).toBe(1);
  });

  it("stops when the run would withdraw more than 10% of the date's candidates", async () => {
    const active = Array.from({ length: 20 }, (_, i) => `c${i}`);
    setStale({ activeCandidates: active, staleCandidates: active.slice(0, 10) });

    await expect(ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW)).rejects.toThrow(
      /would withdraw 10 of 20 active candidates/
    );
    expect(mockDb.candidate.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "withdrawn" } })
    );
  });

  it("allows a mass withdrawal with force", async () => {
    const active = Array.from({ length: 20 }, (_, i) => `c${i}`);
    setStale({ activeCandidates: active, staleCandidates: active.slice(0, 10) });
    mockDb.candidate.updateMany.mockResolvedValue({ count: 10 });

    const stats = await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW, { force: true });
    expect(stats.candidatesWithdrawn).toBe(10);
  });

  it("allows a few withdrawals even when they exceed 10% of a small election", async () => {
    setStale({ activeCandidates: ["c1", "c2", "c3"], staleCandidates: ["c1", "c2"] });
    mockDb.candidate.updateMany.mockResolvedValue({ count: 2 });

    const stats = await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW);
    expect(stats.candidatesWithdrawn).toBe(2);
  });

  it("retires elections the source no longer lists", async () => {
    setStale({ listedElections: ["e-current", "e-renamed"], staleElections: ["e-renamed"] });
    mockDb.election.updateMany.mockResolvedValue({ count: 1 });

    const stats = await ingestRaces(provider([senateRace()]), { electionDate: "2026-11-03" }, NOW);

    expect(mockDb.election.findMany).toHaveBeenCalledWith({
      where: { electionDate: ELECTION_DAY, status: { not: "concluded" } },
      select: { id: true },
    });
    expect(mockDb.election.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["e-renamed"] } },
      data: { status: "concluded" },
    });
    expect(stats.electionsRetired).toBe(1);
  });

  it("aborts without withdrawing anyone when the provider returns no races", async () => {
    await expect(ingestRaces(provider([]), { electionDate: "2026-11-03" }, NOW)).rejects.toThrow(/no races/);
    expect(mockDb.externalRef.findMany).not.toHaveBeenCalled();
    expect(mockDb.candidate.updateMany).not.toHaveBeenCalled();
  });
});
