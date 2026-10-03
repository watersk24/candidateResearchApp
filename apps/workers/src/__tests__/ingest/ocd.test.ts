/**
 * OCD-ID helper tests.
 *
 * KEEP IN SYNC with apps/web/src/__tests__/lib/ocd.test.ts — the same cases
 * guard against the two copies of ocdSegment() drifting apart.
 */

import { describe, it, expect } from "vitest";
import { OCD_US, ocdSegment, ocdState } from "../../ingest/ocd.js";

const SEGMENT_CASES: [string, string][] = [
  ["New Hanover", "new_hanover"],
  ["NEW HANOVER", "new_hanover"],
  ["Elizabeth City", "elizabeth_city"],
  ["  Pitt  ", "pitt"],
  ["Kill Devil Hills", "kill_devil_hills"],
  ["St. Pauls", "st_pauls"],
  ["O'Neal's Crossing", "oneals_crossing"],
  ["Winston-Salem", "winston-salem"],
  ["NC", "nc"],
];

describe("ocdSegment", () => {
  it.each(SEGMENT_CASES)("%s → %s", (input, expected) => {
    expect(ocdSegment(input)).toBe(expected);
  });
});

describe("ocdState", () => {
  it("builds a state division ID", () => {
    expect(ocdState("NC")).toBe(`${OCD_US}/state:nc`);
  });
});
