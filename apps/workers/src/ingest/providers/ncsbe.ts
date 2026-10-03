import axios from "axios";
import { OCD_US, ocdSegment, ocdState } from "../ocd.js";
import type {
  NormalizedCandidate,
  NormalizedDistrict,
  NormalizedJurisdiction,
  ProviderResult,
  RaceDataProvider,
} from "../types.js";

// North Carolina State Board of Elections candidate listing (ADR-008).
// Public file, updated as candidates file, withdraw, or are replaced.
export function candidateListingUrl(year: string): string {
  return `https://s3.amazonaws.com/dl.ncsbe.gov/Elections/${year}/Candidate%20Filing/Candidate_Listing_${year}.csv`;
}

// Only these columns are read. The file also contains candidates' street
// addresses, phone numbers, and email addresses, which are deliberately never
// extracted or stored.
const REQUIRED_COLUMNS = [
  "election_dt",
  "county_name",
  "contest_name",
  "name_on_ballot",
  "party_candidate",
  "is_partisan",
] as const;

export type NcsbeRow = {
  electionDate: string | null; // YYYY-MM-DD
  county: string;
  contest: string;
  ballotName: string;
  party: string;
  isPartisan: boolean;
};

// ── CSV parsing ───────────────────────────────────────────────────────────────

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // A stray quote would otherwise swallow the rest of the file into one field
  if (inQuotes) throw new Error("CSV ends inside a quoted field (truncated or malformed file)");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** "11/03/2026" → "2026-11-03" */
export function parseNcDate(value: string): string | null {
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

// A few malformed rows are skipped and reported; more than this suggests a
// broken file, and the import stops rather than publishing shifted columns.
const MAX_MALFORMED_ROWS = 10;

export function toRows(table: string[][]): { rows: NcsbeRow[]; skippedRows: number } {
  const [header, ...body] = table;
  if (!header) throw new Error("NCSBE candidate listing is empty");

  const index = Object.fromEntries(header.map((name, i) => [name.trim(), i]));
  const missing = REQUIRED_COLUMNS.filter((c) => index[c] === undefined);
  if (missing.length > 0) {
    throw new Error(`NCSBE candidate listing is missing columns: ${missing.join(", ")}`);
  }

  // Columns are read by position, so a row with the wrong field count (e.g. an
  // unescaped comma in an address) would shift contact details into the party
  // or name fields. Such rows are dropped, never partially read.
  const wellFormed = body.filter((r) => r.length === header.length);
  const skippedRows = body.length - wellFormed.length;
  if (skippedRows > MAX_MALFORMED_ROWS) {
    throw new Error(`NCSBE candidate listing has ${skippedRows} malformed rows; refusing to import`);
  }

  const col = (r: string[], name: (typeof REQUIRED_COLUMNS)[number]) => r[index[name]].trim();

  const rows = wellFormed.map((r) => ({
    electionDate: parseNcDate(col(r, "election_dt")),
    county: col(r, "county_name").toUpperCase(),
    contest: col(r, "contest_name").toUpperCase(),
    ballotName: col(r, "name_on_ballot"),
    party: col(r, "party_candidate").toUpperCase(),
    isPartisan: col(r, "is_partisan").toUpperCase() === "TRUE",
  }));
  return { rows, skippedRows };
}

// ── Display helpers ───────────────────────────────────────────────────────────

const KEEP_UPPER = new Set(["US", "NC"]);
const KEEP_LOWER = new Set(["OF", "AND", "THE"]);

/** "NC HOUSE OF REPRESENTATIVES DISTRICT 008" → "NC House of Representatives District 8" */
export function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      if (/^\d+$/.test(word)) return String(parseInt(word, 10));
      if (KEEP_UPPER.has(word)) return word;
      if (i > 0 && KEEP_LOWER.has(word)) return word.toLowerCase();
      return word
        .split("-")
        .map((part) => part.toLowerCase().replace(/[a-z]/, (c) => c.toUpperCase()))
        .join("-");
    })
    .join(" ");
}

const PARTY_NAMES: Record<string, string> = {
  DEM: "Democrat",
  REP: "Republican",
  LIB: "Libertarian",
  GRE: "Green",
  UNA: "Unaffiliated",
  CST: "Constitution",
  NLB: "No Labels",
  JFA: "Justice for All",
};

/** Known codes only; anything else (including garbage from a malformed row) is dropped. */
export function partyName(code: string, isPartisan: boolean): string | null {
  if (!isPartisan || !code) return null;
  return PARTY_NAMES[code] ?? null;
}

// ── Contest → district classification ─────────────────────────────────────────

const US: NormalizedJurisdiction = { ocdId: OCD_US, name: "United States", type: "federal" };
const NC_OCD = ocdState("nc");
const NC: NormalizedJurisdiction = { ocdId: NC_OCD, name: "North Carolina", type: "state", parent: US };

// Offices elected by the whole county. "<COUNTY> COUNTY <office>"; soil and
// water supervisors are listed without the word COUNTY.
const COUNTY_WIDE_OFFICE =
  /^(?:COUNTY )?(BOARD OF COMMISSIONERS(?: AT-LARGE| MEMBERS| CHAIRMAN)?|SHERIFF|CLERK OF SUPERIOR COURT|REGISTER OF DEEDS|CORONER|TAX COLLECTOR|SOIL AND WATER CONSERVATION DISTRICT SUPERVISOR)$/;

// At-large municipal offices. The lazy place-name group plus the anchored office
// list splits "CITY OF ELIZABETH CITY CITY COUNCIL" as "ELIZABETH CITY" + "CITY COUNCIL".
// Ward- and district-based seats intentionally don't match (they need precinct data).
const MUNICIPAL_AT_LARGE =
  /^(CITY|TOWN|VILLAGE) OF (.+?) (CITY COUNCIL|TOWN COUNCIL|VILLAGE COUNCIL|COUNCIL MEMBERS?|COUNCILM[AE]N|COUNCIL|BOARD OF COMMISSIONERS|BOARD OF ALDERMEN|ALDERM[AE]N|CITY COMMISSIONERS?|TOWN COMMISSIONERS?|COMMISSIONERS?|MAYOR|TRUSTEES?)(?: AT-LARGE)?$/;

/**
 * Maps an NCSBE contest to the district whose voters see it, or null if the
 * contest needs precinct-level data (school boards, judicial and prosecutorial
 * districts, districted commissioner and ward seats, special districts).
 */
export function classifyContest(contestName: string, countyName: string): NormalizedDistrict | null {
  // Only these notes are known not to change who votes in a contest. Others,
  // such as "(WEST)", mark sub-districts; stripping them would show a district
  // seat to the whole county or town, so such contests stay unmatched.
  const contest = contestName.replace(/\s*\((UNEXPIRED|SPECIAL)\)\s*/g, " ").trim();
  if (contest.includes("(")) return null;
  let m: RegExpMatchArray | null;

  if (contest === "US SENATE") {
    return { ocdId: NC_OCD, districtType: "senate", level: "federal", name: "U.S. Senate — North Carolina", jurisdiction: US };
  }
  if ((m = contest.match(/^US HOUSE OF REPRESENTATIVES DISTRICT (\d+)$/))) {
    const n = parseInt(m[1], 10);
    return { ocdId: `${NC_OCD}/cd:${n}`, districtType: "congressional", level: "federal", name: `U.S. House — North Carolina District ${n}`, jurisdiction: US };
  }
  if ((m = contest.match(/^NC STATE SENATE DISTRICT (\d+)$/))) {
    const n = parseInt(m[1], 10);
    return { ocdId: `${NC_OCD}/sldu:${n}`, districtType: "state_senate", level: "state", name: `NC Senate District ${n}`, jurisdiction: NC };
  }
  if ((m = contest.match(/^NC HOUSE OF REPRESENTATIVES DISTRICT (\d+)$/))) {
    const n = parseInt(m[1], 10);
    return { ocdId: `${NC_OCD}/sldl:${n}`, districtType: "state_house", level: "state", name: `NC House District ${n}`, jurisdiction: NC };
  }
  if (/^NC (SUPREME COURT|COURT OF APPEALS)\b/.test(contest)) {
    return { ocdId: NC_OCD, districtType: "statewide", level: "state", name: "North Carolina (statewide)", jurisdiction: NC };
  }

  const county = countyName.trim().toUpperCase();
  if (county && contest.startsWith(`${county} `) && COUNTY_WIDE_OFFICE.test(contest.slice(county.length + 1))) {
    const name = `${titleCase(county)} County`;
    const ocdId = `${NC_OCD}/county:${ocdSegment(county)}`;
    return {
      ocdId,
      districtType: "county",
      level: "local",
      name,
      jurisdiction: { ocdId, name, type: "county", parent: NC },
    };
  }

  if ((m = contest.match(MUNICIPAL_AT_LARGE))) {
    const name = `${titleCase(m[1])} of ${titleCase(m[2])}`;
    const ocdId = `${NC_OCD}/place:${ocdSegment(m[2])}`;
    return {
      ocdId,
      districtType: "municipal",
      level: "local",
      name,
      jurisdiction: { ocdId, name, type: "city", parent: NC },
    };
  }

  return null;
}

// ── Rows → normalized races ───────────────────────────────────────────────────

/**
 * Only general elections (held in November in NC) are supported. Primary rows
 * share contest names across parties (told apart by `party_contest`), so
 * grouping them by name would put both parties' candidates on one ballot.
 */
export function assertGeneralElectionDate(electionDate: string): void {
  if (electionDate.slice(5, 7) !== "11") {
    throw new Error(`NCSBE import supports November general elections only (got ${electionDate})`);
  }
}

export function buildRaces(rows: NcsbeRow[], electionDate: string): ProviderResult {
  assertGeneralElectionDate(electionDate);
  const contests = new Map<
    string,
    { district: NormalizedDistrict | null; candidates: Map<string, NormalizedCandidate> }
  >();

  // The listing repeats multi-county contests once per county; group by contest name.
  for (const row of rows) {
    if (row.electionDate !== electionDate || !row.contest) continue;

    let entry = contests.get(row.contest);
    if (!entry) {
      entry = { district: classifyContest(row.contest, row.county), candidates: new Map() };
      contests.set(row.contest, entry);
    }
    if (row.ballotName && !entry.candidates.has(row.ballotName)) {
      entry.candidates.set(row.ballotName, {
        externalId: `${electionDate}|${row.contest}|${row.ballotName}`,
        fullName: row.ballotName,
        party: partyName(row.party, row.isPartisan),
      });
    }
  }

  const result: ProviderResult = { races: [], unmatchedContests: [], skippedRows: 0 };
  for (const [contest, { district, candidates }] of contests) {
    if (!district) {
      result.unmatchedContests.push(contest);
      continue;
    }
    result.races.push({
      externalId: `${electionDate}|${contest}`,
      name: titleCase(contest),
      electionDate,
      electionType: "general",
      district,
      candidates: [...candidates.values()],
    });
  }
  result.unmatchedContests.sort();
  return result;
}

export const ncsbeProvider: RaceDataProvider = {
  source: "ncsbe",
  async listRaces({ electionDate }) {
    assertGeneralElectionDate(electionDate);
    const url = candidateListingUrl(electionDate.slice(0, 4));
    const res = await axios.get<string>(url, {
      responseType: "text",
      timeout: 60_000,
      maxContentLength: 100 * 1024 * 1024, // the real file is ~2 MB
      maxRedirects: 0,
    });
    const { rows, skippedRows } = toRows(parseCsv(res.data));
    return { ...buildRaces(rows, electionDate), skippedRows };
  },
};
