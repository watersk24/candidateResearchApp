// Open Civic Data division ID helpers (ADR-008).
//
// KEEP IN SYNC with apps/workers/src/ingest/ocd.ts: ingestion builds IDs there
// and the location lookup builds them here; they must produce identical strings
// or races won't be found. Both test files share the same cases.

export const OCD_US = "ocd-division/country:us";

/** Normalizes a name into an OCD-ID segment: "New Hanover" → "new_hanover". */
export function ocdSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_~-]/g, "");
}

export function ocdState(stateAbbr: string): string {
  return `${OCD_US}/state:${ocdSegment(stateAbbr)}`;
}
