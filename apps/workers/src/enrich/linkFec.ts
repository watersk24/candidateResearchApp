/**
 * Links federal candidates already imported from a ballot source (e.g. NCSBE)
 * to their FEC candidate IDs, stored as ExternalRef rows with source "fec"
 * (ADR-008 Slice 4). Also records incumbency, which the FEC reports and the
 * NCSBE listing does not.
 *
 * The FEC is never used to decide who is on the ballot: it lists primary
 * losers and withdrawn candidates alongside the general-election field.
 */

import { prisma } from "../lib/db.js";
import { listRaceCandidates, type FecRaceCandidate } from "../lib/fec.js";
import { matchFecCandidate, matchStrength } from "./fecMatch.js";
import { confirmedFecId } from "./fecConfirmedLinks.js";
import { FEC_SOURCE } from "./fecRefs.js";

export type LinkStats = {
  races: number;
  linked: number;
  alreadyLinked: number;
  unlinkedStale: string[];
  unmatched: string[];
  needsConfirmation: string[];
  ambiguous: string[];
  failedRaces: string[];
};

type FecRace = { state: string; office: "H" | "S"; district?: string };

// FEC candidate IDs: office letter + 8 alphanumerics, e.g. H2NC02287
const FEC_ID = /^[HSP][0-9A-Z]{8}$/;

function federalOffice(districtType: string): "H" | "S" | null {
  const type = districtType.toLowerCase();
  if (type.startsWith("state")) return null; // state_house, state_senate, statewide
  if (type.includes("congressional") || type.includes("house")) return "H";
  if (type.includes("senate")) return "S";
  return null;
}

/** OCD-ID + district type → the FEC's race key, or null if not a federal race. */
export function fecRaceFor(ocdId: string, districtType: string): FecRace | null {
  const state = ocdId.match(/\/state:([a-z]{2})(\/|$)/)?.[1];
  const office = federalOffice(districtType);
  if (!state || !office) return null;
  if (office === "S") return { state: state.toUpperCase(), office };

  const cd = ocdId.match(/\/cd:(\d+)$/)?.[1];
  // A state with one House seat has no cd: segment; the FEC calls it district 00
  return { state: state.toUpperCase(), office, district: (cd ?? "0").padStart(2, "0") };
}

function incumbency(filer: FecRaceCandidate): boolean | undefined {
  if (filer.incumbent_challenge === "I") return true;
  if (filer.incumbent_challenge === "C" || filer.incumbent_challenge === "O") return false;
  return undefined; // unknown: leave as is
}

type Candidate = { id: string; fullName: string };
type Election = {
  electionDate: Date;
  district: { ocdId: string | null; districtType: string; name: string };
  candidates: Candidate[];
};

export async function linkFecIds(electionDate: string, now: Date = new Date()): Promise<LinkStats> {
  const stats: LinkStats = {
    races: 0,
    linked: 0,
    alreadyLinked: 0,
    unlinkedStale: [],
    unmatched: [],
    needsConfirmation: [],
    ambiguous: [],
    failedRaces: [],
  };

  const elections = await prisma.election.findMany({
    where: {
      electionDate: new Date(electionDate),
      status: { in: ["upcoming", "active"] },
      district: { level: "federal" },
    },
    include: {
      district: true,
      candidates: { where: { status: "active" } },
    },
  });

  for (const election of elections) {
    const race = fecRaceFor(election.district.ocdId ?? "", election.district.districtType);
    if (!race || election.candidates.length === 0) continue;
    stats.races++;
    try {
      await linkRace(election, race, now, stats);
    } catch (err) {
      // Message only: axios errors carry the request config, including the API key
      stats.failedRaces.push(`${election.district.name}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return stats;
}

async function linkRace(election: Election, race: FecRace, now: Date, stats: LinkStats) {
  const ocdId = election.district.ocdId ?? "";
  const label = (name: string) => `${name} (${election.district.name})`;

  const filers = await listRaceCandidates({ electionYear: election.electionDate.getUTCFullYear(), ...race });
  if (filers.length === 0) {
    // Every race we import has filers; an empty list means a bad response, and
    // treating it as real would unlink everyone
    throw new Error("FEC returned no filers for this race");
  }

  const existingRefs = await prisma.externalRef.findMany({
    where: { source: FEC_SOURCE, entityType: "candidate", entityId: { in: election.candidates.map((c) => c.id) } },
  });
  const refByCandidate = new Map(existingRefs.map((r) => [r.entityId, r]));

  // Phase 1: decide each candidate's FEC ID
  const proposed = new Map<string, FecRaceCandidate>(); // candidate id → filer to link
  for (const candidate of election.candidates) {
    const existing = refByCandidate.get(candidate.id);
    const confirmed = confirmedFecId(ocdId, candidate.fullName);

    if (existing) {
      const filer = filers.find((f) => f.candidate_id === existing.externalId);
      const stillValid =
        filer && (existing.externalId === confirmed || matchStrength(candidate.fullName, filer.name) === "exact");
      if (filer && stillValid) {
        stats.alreadyLinked++;
        await prisma.externalRef.update({ where: { id: existing.id }, data: { lastSeenAt: now } });
        const isIncumbent = incumbency(filer);
        if (isIncumbent !== undefined) {
          await prisma.candidate.update({ where: { id: candidate.id }, data: { isIncumbent } });
        }
        continue;
      }
      // Dropped from the race's filers, or the ballot name changed: unlink, then re-match below
      await prisma.externalRef.delete({ where: { id: existing.id } });
      stats.unlinkedStale.push(`${label(candidate.fullName)}: ${existing.externalId}`);
    }

    const match = matchFecCandidate(candidate.fullName, filers, confirmed);
    if (match.kind === "unmatched") {
      stats.unmatched.push(label(candidate.fullName));
    } else if (match.kind === "needsConfirmation") {
      stats.needsConfirmation.push(`${label(candidate.fullName)}: ${match.candidateIds.join(", ")}`);
    } else if (match.kind === "ambiguous") {
      stats.ambiguous.push(`${label(candidate.fullName)}: ${match.candidateIds.join(", ")}`);
    } else if (!FEC_ID.test(match.candidate.candidate_id)) {
      stats.ambiguous.push(`${label(candidate.fullName)}: invalid FEC ID "${match.candidate.candidate_id}"`);
    } else {
      proposed.set(candidate.id, match.candidate);
    }
  }

  // Phase 2: an FEC ID claimed by two candidates in this race links to neither
  const claims = new Map<string, number>();
  for (const filer of proposed.values()) claims.set(filer.candidate_id, (claims.get(filer.candidate_id) ?? 0) + 1);

  for (const candidate of election.candidates) {
    const filer = proposed.get(candidate.id);
    if (!filer) continue;
    const fecId = filer.candidate_id;
    if ((claims.get(fecId) ?? 0) > 1) {
      stats.ambiguous.push(`${label(candidate.fullName)}: ${fecId} matched more than one candidate`);
      continue;
    }

    // One FEC ID can belong to one candidate row. A holder from an earlier
    // election, or a withdrawn holder (e.g. replaced after a ballot-name
    // correction), gives it up; an active holder in this election keeps it.
    const taken = await prisma.externalRef.findUnique({
      where: { source_externalId: { source: FEC_SOURCE, externalId: fecId } },
    });
    if (taken) {
      const holder = await prisma.candidate.findUnique({
        where: { id: taken.entityId },
        include: { election: true },
      });
      // Same election date rather than same election row: errs toward reporting
      // a conflict instead of reassigning
      const holderIsCurrent =
        holder?.status === "active" && holder.election.electionDate.getTime() === election.electionDate.getTime();
      if (holder && holderIsCurrent) {
        stats.ambiguous.push(`${label(candidate.fullName)}: ${fecId} already linked to "${holder.fullName}"`);
        continue;
      }
    }

    const isIncumbent = incumbency(filer);
    await prisma.$transaction([
      taken
        ? prisma.externalRef.update({ where: { id: taken.id }, data: { entityId: candidate.id, lastSeenAt: now } })
        : prisma.externalRef.create({
            data: { entityType: "candidate", entityId: candidate.id, source: FEC_SOURCE, externalId: fecId, lastSeenAt: now },
          }),
      prisma.candidate.update({
        where: { id: candidate.id },
        data: isIncumbent === undefined ? {} : { isIncumbent },
      }),
    ]);
    stats.linked++;
    // Audit trail, so a wrong attribution can be traced and reversed
    console.log(
      `[linkFec] ${label(candidate.fullName)} → ${fecId} (FEC: ${filer.name})` +
        (taken ? `, moved from candidate ${taken.entityId}` : "")
    );
  }
}
