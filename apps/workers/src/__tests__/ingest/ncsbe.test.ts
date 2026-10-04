/**
 * NCSBE provider tests (ADR-008)
 *
 * Covers:
 *  - parseCsv(): quoting, escaped quotes, CRLF/LF, trailing newline
 *  - toRows(): header validation, only required columns extracted
 *  - titleCase() / partyName() display helpers
 *  - classifyContest(): each supported contest family, and contests deferred to Slice 2
 *  - buildRaces(): grouping multi-county contests, date filtering, unmatched reporting
 *  - ncsbeProvider.listRaces(): fetch + parse with mocked axios
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAxios = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("axios", () => ({ default: mockAxios }));

import {
  parseCsv,
  parseNcDate,
  toRows,
  titleCase,
  partyName,
  classifyContest,
  buildRaces,
  candidateListingUrl,
  ncsbeProvider,
  type NcsbeRow,
} from "../../ingest/providers/ncsbe.js";

const HEADER =
  '"election_dt","county_name","contest_name","name_on_ballot","first_name","street_address","phone","email","party_candidate","is_partisan","vote_for"';

function csvLine(fields: string[]): string {
  return fields.map((f) => `"${f.replace(/"/g, '""')}"`).join(",");
}

function row(overrides: Partial<NcsbeRow> = {}): NcsbeRow {
  return {
    electionDate: "2026-11-03",
    county: "WAKE",
    contest: "US SENATE",
    ballotName: "Jane Doe",
    party: "DEM",
    isPartisan: true,
    ...overrides,
  };
}

// ── parseCsv ──────────────────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("parses quoted fields containing commas and escaped quotes", () => {
    expect(parseCsv('"a,b","say ""hi""",c\r\n')).toEqual([["a,b", 'say "hi"', "c"]]);
  });

  it("handles LF and CRLF line endings and a missing trailing newline", () => {
    expect(parseCsv("a,b\nc,d\r\ne,f")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
    ]);
  });

  it("keeps newlines inside quoted fields", () => {
    expect(parseCsv('"line1\nline2",x\n')).toEqual([["line1\nline2", "x"]]);
  });

  it("skips blank lines and preserves empty fields", () => {
    expect(parseCsv("a,,c\n\n")).toEqual([["a", "", "c"]]);
  });

  it("throws on an unterminated quote instead of swallowing the rest of the file", () => {
    expect(() => parseCsv('a,"b\nc,d\ne,f\n')).toThrow(/quoted field/);
  });
});

// ── toRows ────────────────────────────────────────────────────────────────────

describe("toRows", () => {
  it("extracts only the required columns, never contact details", () => {
    const table = parseCsv(
      [
        HEADER,
        csvLine(["11/03/2026", "Wake", "us senate", "Jane Doe", "Jane", "1 Main St", "555-1234", "jane@example.com", "dem", "TRUE", "1"]),
      ].join("\r\n")
    );
    const {
      rows: [r],
      skippedRows,
    } = toRows(table);
    expect(skippedRows).toBe(0);
    expect(r).toEqual({
      electionDate: "2026-11-03",
      county: "WAKE",
      contest: "US SENATE",
      ballotName: "Jane Doe",
      party: "DEM",
      isPartisan: true,
    });
    expect(JSON.stringify(r)).not.toMatch(/Main St|555-1234|example\.com/);
  });

  it("throws when a required column is missing", () => {
    expect(() => toRows(parseCsv('"election_dt","county_name"\n"11/03/2026","WAKE"'))).toThrow(
      /missing columns: contest_name, name_on_ballot, party_candidate, is_partisan/
    );
  });

  it("throws on an empty file", () => {
    expect(() => toRows([])).toThrow(/empty/);
  });

  it("drops rows whose field count doesn't match the header, so columns can't shift", () => {
    const good = csvLine(["11/03/2026", "WAKE", "US SENATE", "Jane Doe", "", "", "", "", "DEM", "TRUE", "1"]);
    // An extra field (e.g. an unescaped comma in the address) shifts the email into party_candidate
    const shifted = csvLine(["11/03/2026", "WAKE", "US SENATE", "John Roe", "", "1 Main St", "Apt 2", "555-1234", "john@example.com", "TRUE", "1", "x"]);
    const { rows, skippedRows } = toRows(parseCsv([HEADER, good, shifted].join("\n")));

    expect(skippedRows).toBe(1);
    expect(rows.map((r) => r.ballotName)).toEqual(["Jane Doe"]);
    expect(JSON.stringify(rows)).not.toMatch(/example\.com|555-1234/);
  });

  it("refuses the whole file when more than 10 rows are malformed", () => {
    const bad = csvLine(["11/03/2026", "WAKE"]);
    expect(() => toRows(parseCsv([HEADER, ...Array(11).fill(bad)].join("\n")))).toThrow(/11 malformed rows/);
  });
});

describe("parseNcDate", () => {
  it("converts MM/DD/YYYY to ISO", () => {
    expect(parseNcDate("11/03/2026")).toBe("2026-11-03");
  });

  it("returns null for unexpected formats", () => {
    expect(parseNcDate("2026-11-03")).toBeNull();
    expect(parseNcDate("")).toBeNull();
  });
});

// ── Display helpers ───────────────────────────────────────────────────────────

describe("titleCase", () => {
  it.each([
    ["NC HOUSE OF REPRESENTATIVES DISTRICT 008", "NC House of Representatives District 8"],
    ["US SENATE", "US Senate"],
    ["WAKE COUNTY BOARD OF COMMISSIONERS AT-LARGE", "Wake County Board of Commissioners At-Large"],
    ["NC SUPREME COURT ASSOCIATE JUSTICE SEAT 01 (UNEXPIRED)", "NC Supreme Court Associate Justice Seat 1 (Unexpired)"],
  ])("%s → %s", (input, expected) => {
    expect(titleCase(input)).toBe(expected);
  });
});

describe("partyName", () => {
  it("maps known party codes", () => {
    expect(partyName("DEM", true)).toBe("Democrat");
    expect(partyName("REP", true)).toBe("Republican");
    expect(partyName("UNA", true)).toBe("Unaffiliated");
  });

  it("drops unknown codes rather than publishing arbitrary text as a party", () => {
    expect(partyName("XYZ", true)).toBeNull();
    expect(partyName("JANE@EXAMPLE.COM", true)).toBeNull();
  });

  it("returns null for nonpartisan contests or a blank party", () => {
    expect(partyName("DEM", false)).toBeNull();
    expect(partyName("", true)).toBeNull();
  });
});

// ── classifyContest ───────────────────────────────────────────────────────────

describe("classifyContest", () => {
  it("maps US Senate to the state division as a federal senate district", () => {
    expect(classifyContest("US SENATE", "WAKE")).toMatchObject({
      ocdId: "ocd-division/country:us/state:nc",
      districtType: "senate",
      level: "federal",
    });
  });

  it("maps US House districts and strips leading zeros", () => {
    expect(classifyContest("US HOUSE OF REPRESENTATIVES DISTRICT 03", "PITT")).toMatchObject({
      ocdId: "ocd-division/country:us/state:nc/cd:3",
      districtType: "congressional",
      level: "federal",
    });
  });

  it("maps NC Senate and NC House districts", () => {
    expect(classifyContest("NC STATE SENATE DISTRICT 14", "WAKE")).toMatchObject({
      ocdId: "ocd-division/country:us/state:nc/sldu:14",
      districtType: "state_senate",
      level: "state",
    });
    expect(classifyContest("NC HOUSE OF REPRESENTATIVES DISTRICT 008", "PITT")).toMatchObject({
      ocdId: "ocd-division/country:us/state:nc/sldl:8",
      districtType: "state_house",
      level: "state",
    });
  });

  it("maps statewide appellate courts to the state division as a statewide district", () => {
    for (const contest of ["NC SUPREME COURT ASSOCIATE JUSTICE SEAT 01", "NC COURT OF APPEALS JUDGE SEAT 12 (UNEXPIRED)"]) {
      expect(classifyContest(contest, "WAKE")).toMatchObject({
        ocdId: "ocd-division/country:us/state:nc",
        districtType: "statewide",
        level: "state",
      });
    }
  });

  it.each([
    "PITT COUNTY SHERIFF",
    "PITT COUNTY CLERK OF SUPERIOR COURT",
    "PITT COUNTY REGISTER OF DEEDS",
    "PITT COUNTY CORONER",
    "PITT COUNTY TAX COLLECTOR",
    "PITT COUNTY BOARD OF COMMISSIONERS",
    "PITT COUNTY BOARD OF COMMISSIONERS AT-LARGE",
    "PITT SOIL AND WATER CONSERVATION DISTRICT SUPERVISOR",
  ])("maps county-wide office %s to the county", (contest) => {
    expect(classifyContest(contest, "PITT")).toMatchObject({
      ocdId: "ocd-division/country:us/state:nc/county:pitt",
      districtType: "county",
      level: "local",
      name: "Pitt County",
      jurisdiction: { type: "county" },
    });
  });

  it("handles multi-word county names", () => {
    expect(classifyContest("NEW HANOVER COUNTY SHERIFF", "NEW HANOVER")).toMatchObject({
      ocdId: "ocd-division/country:us/state:nc/county:new_hanover",
      name: "New Hanover County",
    });
  });

  it.each([
    ["CITY OF RALEIGH CITY COUNCIL AT-LARGE", "raleigh", "City of Raleigh"],
    ["TOWN OF ELKIN COMMISSIONER", "elkin", "Town of Elkin"],
    ["TOWN OF RIVER BEND COUNCIL MEMBER", "river_bend", "Town of River Bend"],
    ["CITY OF SALUDA MAYOR", "saluda", "City of Saluda"],
    ["CITY OF ELIZABETH CITY CITY COUNCIL", "elizabeth_city", "City of Elizabeth City"],
    ["TOWN OF FAITH BOARD OF ALDERMEN", "faith", "Town of Faith"],
  ])("maps at-large municipal contest %s", (contest, segment, name) => {
    expect(classifyContest(contest, "WAKE")).toMatchObject({
      ocdId: `ocd-division/country:us/state:nc/place:${segment}`,
      districtType: "municipal",
      level: "local",
      name,
      jurisdiction: { type: "city" },
    });
  });

  it.each([
    "PITT COUNTY BOARD OF COMMISSIONERS DISTRICT 2",
    "PITT COUNTY BOARD OF EDUCATION",
    "PITT COUNTY BOARD OF EDUCATION DISTRICT 4",
    "NC DISTRICT COURT JUDGE DISTRICT 03 SEAT 02",
    "NC SUPERIOR COURT JUDGE DISTRICT 10A SEAT 01",
    "DISTRICT ATTORNEY DISTRICT 10",
    "CITY OF ARCHDALE CITY COUNCIL WARD 1",
    "HANDY SANITARY DISTRICT SUPERVISOR",
  ])("defers %s to precinct-level matching (returns null)", (contest) => {
    expect(classifyContest(contest, "PITT")).toBeNull();
  });

  it("does not treat another county's offices as county-wide", () => {
    expect(classifyContest("WAKE COUNTY SHERIFF", "PITT")).toBeNull();
  });

  it("strips (UNEXPIRED) and (SPECIAL), which don't change who votes", () => {
    expect(classifyContest("PITT COUNTY BOARD OF COMMISSIONERS AT-LARGE (UNEXPIRED)", "PITT")?.districtType).toBe("county");
    expect(classifyContest("TOWN OF ELKIN COMMISSIONER (SPECIAL)", "SURRY")?.districtType).toBe("municipal");
  });

  it.each([
    "PITT COUNTY BOARD OF COMMISSIONERS (WEST)",
    "TOWN OF ELKIN TOWN COUNCIL (WARD 2)",
    "PITT COUNTY SHERIFF (DISTRICT 3)",
  ])("never widens a sub-district seat to the whole county or town: %s", (contest) => {
    expect(classifyContest(contest, "PITT")).toBeNull();
  });
});

// ── buildRaces ────────────────────────────────────────────────────────────────

describe("buildRaces", () => {
  it("groups a contest listed once per county into one race with unique candidates", () => {
    const { races } = buildRaces(
      [
        row({ county: "WAKE", ballotName: "Jane Doe", party: "DEM" }),
        row({ county: "PITT", ballotName: "Jane Doe", party: "DEM" }),
        row({ county: "PITT", ballotName: "John Roe", party: "REP" }),
      ],
      "2026-11-03"
    );

    expect(races).toHaveLength(1);
    expect(races[0]).toMatchObject({
      externalId: "2026-11-03|US SENATE",
      name: "US Senate",
      electionDate: "2026-11-03",
      electionType: "general",
    });
    expect(races[0].candidates).toEqual([
      { externalId: "2026-11-03|US SENATE|Jane Doe", fullName: "Jane Doe", party: "Democrat" },
      { externalId: "2026-11-03|US SENATE|John Roe", fullName: "John Roe", party: "Republican" },
    ]);
  });

  it("only includes rows for the requested election date", () => {
    const { races } = buildRaces(
      [row({ electionDate: "2026-03-03", ballotName: "Primary Only" }), row({ ballotName: "General" })],
      "2026-11-03"
    );
    expect(races[0].candidates.map((c) => c.fullName)).toEqual(["General"]);
  });

  it("refuses primary dates, where grouping by contest name would merge both parties' ballots", () => {
    expect(() => buildRaces([row({ electionDate: "2026-03-03" })], "2026-03-03")).toThrow(/general elections only/);
  });

  it("reports contests it cannot map instead of dropping them silently", () => {
    const result = buildRaces(
      [row(), row({ contest: "PITT COUNTY BOARD OF EDUCATION DISTRICT 4", county: "PITT" })],
      "2026-11-03"
    );
    expect(result.races).toHaveLength(1);
    expect(result.unmatchedContests).toEqual(["PITT COUNTY BOARD OF EDUCATION DISTRICT 4"]);
  });

  it("skips rows with no ballot name", () => {
    const { races } = buildRaces([row({ ballotName: "" })], "2026-11-03");
    expect(races[0].candidates).toEqual([]);
  });
});

// ── ncsbeProvider ─────────────────────────────────────────────────────────────

describe("ncsbeProvider.listRaces", () => {
  // Braces matter: a function returned from beforeEach runs as a cleanup hook
  beforeEach(() => {
    mockAxios.get.mockReset();
  });

  it("downloads the listing for the election year and returns normalized races", async () => {
    mockAxios.get.mockResolvedValue({
      data: [HEADER, csvLine(["11/03/2026", "WAKE", "US SENATE", "Jane Doe", "", "", "", "", "DEM", "TRUE", "1"])].join("\r\n"),
    });

    const result = await ncsbeProvider.listRaces({ electionDate: "2026-11-03" });

    expect(mockAxios.get).toHaveBeenCalledWith(
      candidateListingUrl("2026"),
      expect.objectContaining({ responseType: "text", maxRedirects: 0, maxContentLength: expect.any(Number) })
    );
    expect(result.skippedRows).toBe(0);
    expect(candidateListingUrl("2026")).toBe(
      "https://s3.amazonaws.com/dl.ncsbe.gov/Elections/2026/Candidate%20Filing/Candidate_Listing_2026.csv"
    );
    expect(result.races).toHaveLength(1);
    expect(result.races[0].candidates[0].fullName).toBe("Jane Doe");
  });

  it("propagates download errors", async () => {
    mockAxios.get.mockRejectedValue(new Error("network down"));
    await expect(ncsbeProvider.listRaces({ electionDate: "2026-11-03" })).rejects.toThrow("network down");
  });

  it("rejects primary dates before downloading anything", async () => {
    await expect(ncsbeProvider.listRaces({ electionDate: "2026-03-03" })).rejects.toThrow(/general elections only/);
    expect(mockAxios.get).not.toHaveBeenCalled();
  });
});

// ── Ingestion ↔ lookup consistency ────────────────────────────────────────────

describe("OCD-IDs line up with the web app's location lookup", () => {
  // MUST MATCH the expected output of censusToOcdIds() for the Greenville, NC
  // fixture in apps/web/src/__tests__/lib/districtResolver.test.ts. If ingestion
  // and lookup disagree, races silently disappear from the dashboard.
  const GREENVILLE_LOOKUP_OCD_IDS = [
    "ocd-division/country:us",
    "ocd-division/country:us/state:nc",
    "ocd-division/country:us/state:nc/cd:3",
    "ocd-division/country:us/state:nc/sldu:5",
    "ocd-division/country:us/state:nc/sldl:8",
    "ocd-division/country:us/state:nc/county:pitt",
    "ocd-division/country:us/state:nc/place:greenville",
  ];

  it.each([
    ["US SENATE", "PITT"],
    ["US HOUSE OF REPRESENTATIVES DISTRICT 03", "PITT"],
    ["NC STATE SENATE DISTRICT 05", "PITT"],
    ["NC HOUSE OF REPRESENTATIVES DISTRICT 008", "PITT"],
    ["NC SUPREME COURT ASSOCIATE JUSTICE SEAT 01", "PITT"],
    ["PITT COUNTY SHERIFF", "PITT"],
    ["CITY OF GREENVILLE CITY COUNCIL AT-LARGE", "PITT"],
  ])("%s is found by a Greenville lookup", (contest, county) => {
    expect(GREENVILLE_LOOKUP_OCD_IDS).toContain(classifyContest(contest, county)?.ocdId);
  });
});
