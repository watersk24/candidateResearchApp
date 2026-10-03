/**
 * FEC links confirmed by a person, for ballot names the matcher only matches
 * loosely (short forms, middle names) or not at all (ADR-008 Slice 4).
 *
 * Add an entry only after checking the FEC record is the same person, e.g.
 * the FEC candidate page shows the same race, party, and campaign. Keyed by
 * district OCD-ID and the exact ballot name; the ID is used only if the FEC
 * still lists it for that race.
 */

export type ConfirmedFecLink = { ocdId: string; ballotName: string; fecId: string; evidence: string };

export const CONFIRMED_FEC_LINKS: ConfirmedFecLink[] = [
  {
    ocdId: "ocd-division/country:us/state:nc/cd:3",
    ballotName: "Greg Murphy",
    fecId: "H0NC03172",
    evidence: "FEC: MURPHY, GREGORY FRANCIS DR., NC-03, marked incumbent, cycles 2022-2026; ballot: Republican incumbent; checked 2026-10-03",
  },
  {
    ocdId: "ocd-division/country:us/state:nc/cd:12",
    ballotName: "Jack Codiga",
    fecId: "H6NC12113",
    evidence: "FEC: CODIGA, JOHN JACK, NC-12, 2026 only, the only Codiga filer in the race; ballot: Republican; checked 2026-10-03",
  },
];

export function confirmedFecId(ocdId: string, ballotName: string): string | undefined {
  return CONFIRMED_FEC_LINKS.find((l) => l.ocdId === ocdId && l.ballotName === ballotName)?.fecId;
}
