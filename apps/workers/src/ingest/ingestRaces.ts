import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import type {
  NormalizedCandidate,
  NormalizedDistrict,
  NormalizedJurisdiction,
  NormalizedRace,
  RaceDataProvider,
} from "./types.js";

export type IngestStats = {
  races: number;
  candidatesCreated: number;
  candidatesUpdated: number;
  candidatesWithdrawn: number;
  electionsRetired: number;
  skippedRows: number;
  newCandidateIds: string[];
  unmatchedContests: string[];
};

export type IngestOptions = {
  // Allow withdrawing more than WITHDRAWAL_LIMIT of a date's candidates in one run
  force?: boolean;
};

// A real source rarely drops more than a handful of candidates between runs.
// Losing more than this share at once points to a truncated or broken file;
// the run stops instead of showing real candidates as withdrawn.
export const WITHDRAWAL_LIMIT = 0.1;
const WITHDRAWAL_LIMIT_MIN_COUNT = 5;

/** "Roy Cooper" + stable ref → "roy-cooper-1a2b3c4d" (unique without a DB round trip). */
export function candidateSlug(fullName: string, externalId: string): string {
  const base = fullName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const hash = createHash("sha1").update(externalId).digest("hex").slice(0, 8);
  return `${base || "candidate"}-${hash}`;
}

export function electionStatus(electionDate: string, now: Date): "upcoming" | "concluded" {
  return electionDate < now.toISOString().slice(0, 10) ? "concluded" : "upcoming";
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

async function upsertJurisdiction(j: NormalizedJurisdiction, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(j.ocdId);
  if (cached) return cached;

  const parentId = j.parent ? await upsertJurisdiction(j.parent, cache) : null;
  const row = await prisma.jurisdiction.upsert({
    where: { ocdId: j.ocdId },
    update: { name: j.name, type: j.type, parentId },
    create: { ocdId: j.ocdId, name: j.name, type: j.type, parentId },
  });
  cache.set(j.ocdId, row.id);
  return row.id;
}

async function upsertDistrict(d: NormalizedDistrict, cache: Map<string, string>): Promise<string> {
  const key = `${d.ocdId}#${d.districtType}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const jurisdictionId = await upsertJurisdiction(d.jurisdiction, cache);
  const row = await prisma.district.upsert({
    where: { ocdId_districtType: { ocdId: d.ocdId, districtType: d.districtType } },
    update: { name: d.name, level: d.level, jurisdictionId },
    create: { ocdId: d.ocdId, districtType: d.districtType, name: d.name, level: d.level, jurisdictionId },
  });
  cache.set(key, row.id);
  return row.id;
}

/**
 * Runs `update` for the entity behind an existing ref and touches the ref.
 * Returns false if the ref is orphaned (its entity was deleted — ExternalRef
 * has no foreign key); the orphan is removed so the caller can recreate it.
 */
async function updateViaRef(
  source: string,
  externalId: string,
  now: Date,
  update: (entityId: string) => Promise<unknown>
): Promise<string | null> {
  const ref = await prisma.externalRef.findUnique({
    where: { source_externalId: { source, externalId } },
  });
  if (!ref) return null;

  try {
    await update(ref.entityId);
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
    await prisma.externalRef.delete({ where: { id: ref.id } });
    return null;
  }
  await prisma.externalRef.update({ where: { id: ref.id }, data: { lastSeenAt: now } });
  return ref.entityId;
}

async function upsertElection(source: string, race: NormalizedRace, districtId: string, now: Date): Promise<string> {
  const data = {
    districtId,
    name: race.name,
    electionType: race.electionType,
    electionDate: new Date(race.electionDate),
    status: electionStatus(race.electionDate, now),
  };

  const existingId = await updateViaRef(source, race.externalId, now, (id) =>
    prisma.election.update({ where: { id }, data })
  );
  if (existingId) return existingId;

  return prisma.$transaction(async (tx) => {
    const election = await tx.election.create({
      data: { ...data, electionCycleStart: new Date(`${race.electionDate.slice(0, 4)}-01-01`) },
    });
    await tx.externalRef.create({
      data: { entityType: "election", entityId: election.id, source, externalId: race.externalId, lastSeenAt: now },
    });
    return election.id;
  });
}

async function upsertCandidate(
  source: string,
  c: NormalizedCandidate,
  electionId: string,
  now: Date
): Promise<{ id: string; created: boolean }> {
  const existingId = await updateViaRef(source, c.externalId, now, async (id) => {
    // Only source-owned fields; enrichment scrapers own the rest.
    await prisma.candidate.update({
      where: { id },
      data: { fullName: c.fullName, party: c.party, electionId },
    });
    // A candidate marked withdrawn who reappears in the source is reinstated
    // (without touching other statuses such as "elected").
    await prisma.candidate.updateMany({
      where: { id, status: "withdrawn" },
      data: { status: "active" },
    });
  });
  if (existingId) return { id: existingId, created: false };

  const id = await prisma.$transaction(async (tx) => {
    const candidate = await tx.candidate.create({
      data: {
        electionId,
        fullName: c.fullName,
        party: c.party,
        profileSlug: candidateSlug(c.fullName, c.externalId),
        status: "active",
      },
    });
    await tx.externalRef.create({
      data: { entityType: "candidate", entityId: candidate.id, source, externalId: c.externalId, lastSeenAt: now },
    });
    return candidate.id;
  });
  return { id, created: true };
}

/** IDs of this source's entities of `entityType` among `ids` not seen in this run. */
async function staleIds(source: string, entityType: string, ids: string[], now: Date): Promise<string[]> {
  if (ids.length === 0) return [];
  const refs = await prisma.externalRef.findMany({
    where: { source, entityType, entityId: { in: ids }, lastSeenAt: { lt: now } },
    select: { entityId: true },
  });
  return refs.map((r) => r.entityId);
}

/**
 * Pulls races from a provider and upserts jurisdictions, districts, elections,
 * and candidates. Active candidates from this source that are no longer listed
 * for the election date are marked withdrawn (never deleted); elections the
 * source no longer lists are retired.
 */
export async function ingestRaces(
  provider: RaceDataProvider,
  scope: { electionDate: string },
  now: Date = new Date(),
  options: IngestOptions = {}
): Promise<IngestStats> {
  const { races, unmatchedContests, skippedRows } = await provider.listRaces(scope);

  // An empty result almost certainly means a broken or moved source file;
  // continuing would mark every existing candidate withdrawn.
  if (races.length === 0) {
    throw new Error(`[ingest:${provider.source}] provider returned no races for ${scope.electionDate}`);
  }

  const cache = new Map<string, string>();
  const stats: IngestStats = {
    races: races.length,
    candidatesCreated: 0,
    candidatesUpdated: 0,
    candidatesWithdrawn: 0,
    electionsRetired: 0,
    skippedRows,
    newCandidateIds: [],
    unmatchedContests,
  };

  for (const race of races) {
    const districtId = await upsertDistrict(race.district, cache);
    const electionId = await upsertElection(provider.source, race, districtId, now);
    for (const c of race.candidates) {
      const { id, created } = await upsertCandidate(provider.source, c, electionId, now);
      if (created) {
        stats.candidatesCreated++;
        stats.newCandidateIds.push(id);
      } else {
        stats.candidatesUpdated++;
      }
    }
  }

  // Every listed entity's ref was touched with `now`. Start from this date's
  // active candidates (a bounded set) and find those whose refs are older.
  const electionDate = new Date(scope.electionDate);
  const active = await prisma.candidate.findMany({
    where: { status: "active", election: { electionDate } },
    select: { id: true },
  });
  const goneCandidates = await staleIds(provider.source, "candidate", active.map((c) => c.id), now);

  if (
    !options.force &&
    goneCandidates.length > WITHDRAWAL_LIMIT_MIN_COUNT &&
    goneCandidates.length > active.length * WITHDRAWAL_LIMIT
  ) {
    throw new Error(
      `[ingest:${provider.source}] would withdraw ${goneCandidates.length} of ${active.length} active candidates ` +
        `for ${scope.electionDate} (limit ${WITHDRAWAL_LIMIT * 100}%). The source file may be incomplete; ` +
        `re-run with --force if the withdrawals are real.`
    );
  }

  if (goneCandidates.length > 0) {
    const { count } = await prisma.candidate.updateMany({
      where: { id: { in: goneCandidates }, status: "active" },
      data: { status: "withdrawn" },
    });
    stats.candidatesWithdrawn = count;
  }

  // Elections the source no longer lists (e.g. a renamed contest) would
  // otherwise remain as empty duplicate race cards.
  const listedElections = await prisma.election.findMany({
    where: { electionDate, status: { not: "concluded" } },
    select: { id: true },
  });
  const goneElections = await staleIds(provider.source, "election", listedElections.map((e) => e.id), now);
  if (goneElections.length > 0) {
    // "concluded" is the only non-displayed status; it hides the race from the dashboard
    const { count } = await prisma.election.updateMany({
      where: { id: { in: goneElections } },
      data: { status: "concluded" },
    });
    stats.electionsRetired = count;
  }

  return stats;
}
