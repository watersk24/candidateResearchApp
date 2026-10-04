/**
 * Matches a ballot name ("Don Davis") to FEC filers for the same race
 * ("DAVIS, DON") (ADR-008 Slice 4).
 *
 * Matching is deliberately strict: last name plus first name or nickname, and
 * only among filers for that exact state, office, and district. Anything less
 * certain is left unlinked or sent for human confirmation, because linking the
 * wrong FEC ID would show one person's fundraising on another's profile.
 */

import type { FecRaceCandidate } from "../lib/fec.js";

// Titles and suffixes the FEC and ballots append to names
const IGNORED_TOKENS = new Set(["jr", "sr", "ii", "iii", "iv", "v", "mr", "mrs", "ms", "dr", "sen", "rep", "hon"]);

type ParsedName = { last: string[]; given: string[]; nicknames: Set<string> };

// Nicknames appear in double quotes or parentheses: Thomas "Tom" Smith, Thomas (Tom) Smith.
// Apostrophes are not quotes here (O'Brien).
const NICKNAME = /["“”(]([^"“”()]+)["“”)]/g;

function nicknamesOf(name: string): Set<string> {
  const found = new Set<string>();
  for (const m of name.matchAll(NICKNAME)) {
    const nick = tokens(m[1])[0];
    if (nick) found.add(nick);
  }
  return found;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "") // O'Brien and OBRIEN compare equal
    .replace(/["“”().,]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !IGNORED_TOKENS.has(t));
}

function withoutNicknames(name: string): string {
  return name.replace(NICKNAME, " ");
}

/** "CODIGA, JOHN JACK" → last ["codiga"], given ["john", "jack"] */
export function parseFecName(name: string): ParsedName {
  const comma = name.indexOf(",");
  const lastPart = comma === -1 ? name : name.slice(0, comma);
  const givenPart = comma === -1 ? "" : name.slice(comma + 1);
  return {
    last: tokens(lastPart),
    given: tokens(withoutNicknames(givenPart)),
    nicknames: nicknamesOf(givenPart),
  };
}

/**
 * How a ballot name matches an FEC name (surname must always match):
 * - "exact": the ballot first name or nickname equals the FEC first name or
 *   nickname ("Don Davis" / DAVIS, DON).
 * - "loose": only a short form ("Greg" / GREGORY) or an FEC middle name
 *   ("Jack Codiga" / CODIGA, JOHN JACK) matches. Plausible, but a relative
 *   with the same surname could match the same way, so loose matches are
 *   linked only when a person has confirmed them (fecConfirmedLinks.ts).
 */
export type MatchStrength = "exact" | "loose";

function isShortForm(a: string, b: string): boolean {
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 3 && short !== long && long.startsWith(short);
}

export function matchStrength(ballotName: string, fecName: string): MatchStrength | null {
  const fec = parseFecName(fecName);
  const ballotTokens = tokens(withoutNicknames(ballotName));
  if (fec.given.length === 0 || fec.last.length === 0 || ballotTokens.length <= fec.last.length) return null;

  // Compare the FEC surname against the same number of trailing ballot tokens,
  // so multi-word surnames ("DE LA CRUZ") match
  if (ballotTokens.slice(-fec.last.length).join(" ") !== fec.last.join(" ")) return null;

  const ballotNames = [ballotTokens[0], ...nicknamesOf(ballotName)];
  const fecFirstNames = [fec.given[0], ...fec.nicknames];
  if (ballotNames.some((b) => fecFirstNames.includes(b))) return "exact";

  const fecAllNames = [...fec.given, ...fec.nicknames];
  const loose = ballotNames.some((b) => fecAllNames.some((f) => f === b || isShortForm(b, f)));
  return loose ? "loose" : null;
}

export function namesMatch(ballotName: string, fecName: string): boolean {
  return matchStrength(ballotName, fecName) !== null;
}

export type FecMatch =
  | { kind: "matched"; candidate: FecRaceCandidate }
  | { kind: "unmatched" }
  | { kind: "ambiguous"; candidateIds: string[] }
  | { kind: "needsConfirmation"; candidateIds: string[] };

function normalizedFecName(name: string): string {
  const parsed = parseFecName(name);
  return `${parsed.last.join(" ")}, ${parsed.given.join(" ")}`;
}

function preferWhere<T>(items: T[], test: (item: T) => boolean): T[] {
  if (items.length < 2) return items;
  const preferred = items.filter(test);
  return preferred.length > 0 ? preferred : items;
}

/**
 * Finds the single FEC filer for a ballot name.
 *
 * A human-confirmed FEC ID wins if the FEC lists it for the race. Otherwise
 * exact matches are used; loose-only matches need confirmation.
 *
 * The FEC sometimes holds two IDs for one person (from earlier campaigns),
 * which report the same totals. Only when every match carries the same FEC
 * name are ties broken, in order by: has raised funds, is the incumbent, most
 * recent filing. Matches with different names may be different people and
 * are always ambiguous.
 */
export function matchFecCandidate(
  ballotName: string,
  filers: FecRaceCandidate[],
  confirmedFecId?: string
): FecMatch {
  if (confirmedFecId) {
    const confirmed = filers.find((f) => f.candidate_id === confirmedFecId);
    if (confirmed) return { kind: "matched", candidate: confirmed };
  }

  const exact = new Map<string, FecRaceCandidate>();
  const loose = new Map<string, FecRaceCandidate>();
  for (const f of filers) {
    const strength = matchStrength(ballotName, f.name);
    if (strength === "exact") exact.set(f.candidate_id, f);
    else if (strength === "loose") loose.set(f.candidate_id, f);
  }

  if (exact.size === 0) {
    return loose.size === 0 ? { kind: "unmatched" } : { kind: "needsConfirmation", candidateIds: [...loose.keys()] };
  }

  let matches = [...exact.values()];
  const distinctNames = new Set(matches.map((m) => normalizedFecName(m.name)));
  if (distinctNames.size > 1) {
    return { kind: "ambiguous", candidateIds: matches.map((m) => m.candidate_id) };
  }

  matches = preferWhere(matches, (m) => m.has_raised_funds);
  matches = preferWhere(matches, (m) => m.incumbent_challenge === "I");
  const latest = matches.map((m) => m.last_file_date ?? "").sort().at(-1);
  if (latest) matches = preferWhere(matches, (m) => m.last_file_date === latest);

  if (matches.length === 1) return { kind: "matched", candidate: matches[0] };
  return { kind: "ambiguous", candidateIds: matches.map((m) => m.candidate_id) };
}
