import type { DistrictLevel, ElectionType, JurisdictionType } from "@prisma/client";

// Source-neutral shapes every race data provider returns (ADR-008).
// Adding a provider (another state, BallotReady, ...) means producing these.

export type NormalizedJurisdiction = {
  ocdId: string;
  name: string;
  type: JurisdictionType;
  parent?: NormalizedJurisdiction;
};

export type NormalizedDistrict = {
  ocdId: string;
  // The scrapers rely on these values: level "federal" plus districtType
  // "senate" | "congressional" selects the Senate / House data sources.
  districtType: string;
  level: DistrictLevel;
  name: string;
  jurisdiction: NormalizedJurisdiction;
};

export type NormalizedCandidate = {
  externalId: string;
  fullName: string;
  party: string | null;
};

export type NormalizedRace = {
  externalId: string;
  name: string;
  electionDate: string; // YYYY-MM-DD
  electionType: ElectionType;
  district: NormalizedDistrict;
  candidates: NormalizedCandidate[];
};

export type ProviderResult = {
  races: NormalizedRace[];
  // Contests the provider found but could not map to a district yet
  unmatchedContests: string[];
  // Source rows dropped as malformed
  skippedRows: number;
};

export interface RaceDataProvider {
  source: string;
  listRaces(scope: { electionDate: string }): Promise<ProviderResult>;
}
