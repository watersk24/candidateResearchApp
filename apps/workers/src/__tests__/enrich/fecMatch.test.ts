/**
 * fecMatch.ts tests (ADR-008 Slice 4)
 *
 * Name pairs are real NCSBE ballot names and FEC filer names for the
 * 2026-11-03 NC general election.
 *
 * Covers:
 *  - Ballot "First Last" matches FEC "LAST, FIRST MIDDLE SUFFIX"
 *  - Exact matches (first name or nickname) link automatically
 *  - Loose matches (Greg/Gregory, Jack = JOHN JACK) need human confirmation
 *  - Different people with the same surname, misspellings, and unrelated
 *    nicknames stay unmatched
 *  - Duplicate FEC IDs for one person: tie-breaks; different names: ambiguous
 */

import { describe, it, expect } from "vitest";
import { matchFecCandidate, matchStrength, namesMatch, parseFecName } from "../../enrich/fecMatch.js";
import type { FecRaceCandidate } from "../../lib/fec.js";

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

describe("parseFecName", () => {
  it("splits surname from given names and drops suffixes and titles", () => {
    expect(parseFecName("DUBLIN, MICHAEL LOUIS JR.")).toEqual({
      last: ["dublin"],
      given: ["michael", "louis"],
      nicknames: new Set(),
    });
    expect(parseFecName("TILLIS, THOM R SEN").given).toEqual(["thom", "r"]);
  });

  it("extracts quoted nicknames", () => {
    expect(parseFecName('JOHNSON, CONSTANCE "CONNIE"').nicknames).toEqual(new Set(["connie"]));
  });
});

describe("matchStrength", () => {
  it.each([
    ["Don Davis", "DAVIS, DON"],
    ["Shannon W. Bray", "BRAY, SHANNON"],
    ["Michael Dublin", "DUBLIN, MICHAEL LOUIS JR."],
    ["Raymond Smith", "SMITH, RAYMOND EDWARD DR. JR."],
    ["Mahesh (Max) Ganorkar", "GANORKAR, MAHESH"],
    ["Richard N. Ojeda II", "OJEDA, RICHARD NEECE II"],
    ["Maad Abu-Ghazalah", "ABU-GHAZALAH, MAAD"],
    ['Connie Johnson', 'JOHNSON, CONSTANCE "CONNIE"'],
    ["Sean O'Brien", "OBRIEN, SEAN"],
    ["Maria de la Cruz", "DE LA CRUZ, MARIA"],
  ])("matches %s to %s exactly", (ballot, fec) => {
    expect(matchStrength(ballot, fec)).toBe("exact");
  });

  it.each([
    ["Greg Murphy", "MURPHY, GREGORY FRANCIS DR."], // short form
    ["Jack Codiga", "CODIGA, JOHN JACK"], // goes by middle name
    ["Ann Lee", "LEE, MARY ANNE"], // short form of a middle name
  ])("matches %s to %s only loosely", (ballot, fec) => {
    expect(matchStrength(ballot, fec)).toBe("loose");
  });

  it.each([
    ["Bo Whitehead", "WHITEHEAD, ROBERT W MR."], // unrelated nickname: not guessed
    ["Matthew Laszacs", "LASACS, MATTHEW"], // misspelled in one source
    ["Paul Barringer", "BARRINGER, PETER"], // same surname, different person
    ["Don Davis", "DAVISON, DON"], // surname prefix is not a match
    ["Al Smith", "SMITH, ALEXANDER"], // two-letter short forms are too loose
    ["Davis", "DAVIS, DON"], // a single ballot token has no first name
  ])("does not match %s to %s", (ballot, fec) => {
    expect(namesMatch(ballot, fec)).toBe(false);
  });
});

describe("matchFecCandidate", () => {
  it("needs confirmation when the only match is loose", () => {
    const filers = [filer("MURPHY, GREGORY FRANCIS DR.", "H0NC03172")];
    expect(matchFecCandidate("Greg Murphy", filers)).toEqual({
      kind: "needsConfirmation",
      candidateIds: ["H0NC03172"],
    });
  });

  it("links a loose match once a person has confirmed the FEC ID", () => {
    const filers = [filer("MURPHY, GREGORY FRANCIS DR.", "H0NC03172"), filer("AYERS, AUSTIN JAY", "H6NC03195")];
    const result = matchFecCandidate("Greg Murphy", filers, "H0NC03172");
    expect(result.kind === "matched" && result.candidate.candidate_id).toBe("H0NC03172");
  });

  it("ignores a confirmed FEC ID the FEC no longer lists for the race", () => {
    const filers = [filer("MURPHY, GREGORY FRANCIS DR.", "H0NC03172")];
    expect(matchFecCandidate("Greg Murphy", filers, "H9NC99999").kind).toBe("needsConfirmation");
  });

  it("prefers an exact match over a loose one", () => {
    const filers = [filer("SMITH, DAN", "H1"), filer("SMITH, DANIELLE", "H2")];
    const result = matchFecCandidate("Dan Smith", filers);
    expect(result.kind === "matched" && result.candidate.candidate_id).toBe("H1");
  });

  it("is ambiguous when exact matches carry different names, without tie-breaking", () => {
    const filers = [
      filer('SMITH, CHRISTOPHER "CHRIS"', "H1", { has_raised_funds: false }),
      filer('SMITH, CHRISTINE "CHRIS"', "H2", { has_raised_funds: true }),
    ];
    expect(matchFecCandidate("Chris Smith", filers)).toEqual({ kind: "ambiguous", candidateIds: ["H1", "H2"] });
  });

  it("returns the single filer whose name matches", () => {
    const filers = [filer("BUCK, ASA BRYANT III", "H1"), filer("BUCKHOUT, LAURIE", "H2")];
    const result = matchFecCandidate("Laurie Buckhout", filers);
    expect(result).toEqual({ kind: "matched", candidate: filers[1] });
  });

  it("returns unmatched when no filer matches", () => {
    expect(matchFecCandidate("Bo Whitehead", [filer("WHITEHEAD, ROBERT W MR.", "H1")])).toEqual({
      kind: "unmatched",
    });
  });

  it("prefers the incumbent ID when one person has two funded IDs", () => {
    const filers = [
      filer("HARRIS, MARK E", "H4NC08066", { incumbent_challenge: "I", last_file_date: null }),
      filer("HARRIS, MARK E", "H6NC09200", { incumbent_challenge: "C", last_file_date: "2025-02-27" }),
    ];
    const result = matchFecCandidate("Mark Harris", filers);
    expect(result.kind === "matched" && result.candidate.candidate_id).toBe("H4NC08066");
  });

  it("then prefers the most recently filed ID", () => {
    const filers = [
      filer("GANORKAR, MAHESH", "H2NC06106", { incumbent_challenge: null, last_file_date: "2023-08-25" }),
      filer("GANORKAR, MAHESH", "H4NC02150", { last_file_date: "2026-08-09" }),
    ];
    const result = matchFecCandidate("Mahesh (Max) Ganorkar", filers);
    expect(result.kind === "matched" && result.candidate.candidate_id).toBe("H4NC02150");
  });

  it("prefers an ID that has raised funds over one that has not", () => {
    const filers = [
      filer("DEBERRY, SHAUNESI YVETTE", "S1", { has_raised_funds: false, last_file_date: "2026-05-01" }),
      filer("DEBERRY, SHAUNESI YVETTE", "S2", { has_raised_funds: true, last_file_date: "2025-01-01" }),
    ];
    const result = matchFecCandidate("Shaunesi DeBerry", filers);
    expect(result.kind === "matched" && result.candidate.candidate_id).toBe("S2");
  });

  it("is ambiguous when two matching IDs cannot be told apart", () => {
    const filers = [filer("SOLOMON, GAVIN", "S1"), filer("SOLOMON, GAVIN", "S2")];
    expect(matchFecCandidate("Gavin Solomon", filers)).toEqual({ kind: "ambiguous", candidateIds: ["S1", "S2"] });
  });

  it("counts a filer listed twice under one ID once", () => {
    const filers = [filer("KNOTT, BRAD", "H4NC13116"), filer("KNOTT, BRAD", "H4NC13116")];
    expect(matchFecCandidate("Brad Knott", filers).kind).toBe("matched");
  });
});
