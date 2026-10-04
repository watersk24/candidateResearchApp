/**
 * fecConfirmedLinks.ts tests — guards the hand-maintained list
 */

import { describe, it, expect } from "vitest";
import { CONFIRMED_FEC_LINKS, confirmedFecId } from "../../enrich/fecConfirmedLinks.js";

describe("CONFIRMED_FEC_LINKS", () => {
  it.each(CONFIRMED_FEC_LINKS)("$ballotName has a well-formed entry with evidence", (link) => {
    expect(link.fecId).toMatch(/^[HSP][0-9A-Z]{8}$/);
    expect(link.ocdId).toMatch(/^ocd-division\/country:us\/state:[a-z]{2}(\/cd:\d+)?$/);
    expect(link.evidence.length).toBeGreaterThan(20);
  });

  it("has at most one entry per candidate", () => {
    const keys = CONFIRMED_FEC_LINKS.map((l) => `${l.ocdId}|${l.ballotName}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("confirmedFecId", () => {
  it("looks up by district and exact ballot name", () => {
    expect(confirmedFecId("ocd-division/country:us/state:nc/cd:3", "Greg Murphy")).toBe("H0NC03172");
    expect(confirmedFecId("ocd-division/country:us/state:nc/cd:4", "Greg Murphy")).toBeUndefined();
    expect(confirmedFecId("ocd-division/country:us/state:nc/cd:3", "Gregory Murphy")).toBeUndefined();
  });
});
