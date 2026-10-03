# ADR-008: Open Data Sources for Races, Candidates, and Districts

**Date:** 2026-10-03
**Status:** Accepted
**Supersedes:** ADR-007 (District Resolution), in part — Cicero becomes an optional provider rather than the primary one

## Context

The app has no way to populate races, candidates, or districts. All four scrapers (`votingRecord`, `campaignFinance`, `newsSentiment`, `computeRatings`) *enrich* a candidate that already exists; nothing creates candidates, elections, or districts. The only data in the system is `prisma/seed.ts`, which is fictional and only reachable through a development-only fallback in `districtResolver.ts`.

The product goal is coverage from federal down to local races. Commercial providers were evaluated (2026-09-26):

| Provider | Coverage | Pricing |
|---|---|---|
| BallotReady (CivicEngine) | Federal → school board, nationwide; districts, candidates, officeholders, bios, stances | Quote only; annual contract |
| Ballotpedia API | Federal/state full; local limited to top 100 cities, top 200 school districts, plus 31 states | Quote only |
| Cicero | Districts and *current officeholders*; no challengers | ~$0.03–0.04 per lookup |

The project owner obtained pricing and decided the cost is not justified before the app's viability is proven. **The MVP uses free, open data sources**, and **North Carolina is the pilot state** for federal-to-local coverage. Paid providers and other states may be added later, so the design must not hard-wire any single source.

## Decision

### 1. Open Civic Data (OCD) division IDs are the canonical district key

Every district is identified by its OCD division ID, e.g. `ocd-division/country:us/state:nc/cd:3` or `ocd-division/country:us/state:nc/county:pitt/council_district:2`. OCD-IDs are a vendor-neutral open standard used by Google Civic, Cicero, Open States, and others. Every data source maps into OCD-IDs; no source's own ID is used as a primary key.

Schema changes:

- `District.ocdId` (unique) and `Jurisdiction.ocdId` (unique) added.
- New `ExternalRef` table `(entityType, entityId, source, externalId, lastSeenAt)` with a unique index on `(source, externalId)`. Records which provider(s) a candidate, election, or district came from. Replaces the vendor-specific `ciceroId` / `ciceroDistrictId` columns, which are dropped (they hold no data).
- New `Precinct` table `(county, precinctCode, geometry)` and `PrecinctDistrict` join table `(precinctId, districtId)` — the precinct is the unit that determines a voter's ballot.

### 2. Location → districts: precinct first, Census Geocoder as fallback

**In a pilot state (NC):** point-in-polygon against the state's precinct boundaries (PostGIS, already enabled on Cloud SQL) returns the voter's precinct; `PrecinctDistrict` returns every district for that precinct — federal through ward.

**Elsewhere:** the U.S. Census Geocoder (`geographies/coordinates`, free, no key) returns congressional, state legislative, county, place, and school districts, converted to OCD-IDs. Verified 2026-10-03: a single call for downtown Austin, TX returned CD-10 (120th Congress, i.e. the 2026 maps), SD-14, HD-49, Travis County, City of Austin, and Austin ISD.

Cicero may be added later as an optional provider. The previous Cicero code path was removed in Slice 1: it returned Cicero's own district IDs, which never matched database rows, so races could not have been found through it.

### 3. Races and candidates: providers behind one interface

```ts
interface RaceDataProvider {
  source: string;                                   // "ncsbe" | "fec" | future: "ballotready" ...
  listRaces(scope: { state?: string; electionDate?: string }): Promise<NormalizedRace[]>;
}
```

`NormalizedRace` = district OCD-ID, office name, level, election date/type, seats (`vote_for`), partisan flag, and candidates (ballot name, party, external ID). One ingestion service upserts normalized results (matching districts by OCD-ID, candidates by `ExternalRef`) and enqueues new candidates for the existing enrichment scrapers.

| Provider | Covers | Source |
|---|---|---|
| **NC State Board of Elections** (pilot) | Every NC contest: federal, statewide, NC General Assembly, judicial (Supreme Court → District Court), district attorney, county offices and commissioner districts, boards of education, municipal/ward | `Candidate_Listing_2026.csv` (4,527 general-election rows, updated 2026-09-27) |
| **FEC** (client exists) | All federal House and Senate candidates nationwide | `api.open.fec.gov/v1/candidates/` |

Adding a state, BallotReady, Ballotpedia, or Cicero means one new adapter returning `NormalizedRace` — no schema or UI changes.

### 4. NC district data is built offline from public files

A setup job (rerun when files change) loads:

1. **Precinct boundaries** — `ShapeFiles/Precinct/SBE_PRECINCTS_20260824.zip` → `Precinct.geometry`.
2. **Precinct → district assignments** — derived from the public statewide voter registration file (`data/ncvoter_Statewide.zip`, updated 2026-09-28). Each record carries the voter's precinct and districts (`cong_dist_abbrv`, `nc_senate_abbrv`, `nc_house_abbrv`, `super_court_abbrv`, `judic_dist_abbrv`, `dist_1_abbrv` [prosecutorial], `county_commiss_abbrv`, `school_dist_abbrv`, `municipality_abbrv`, `ward_abbrv`, …). The job reads **only** the county, precinct, and district columns, writes the distinct combinations, and **never stores names, addresses, or any other personal data**.
3. **Contest → district matching** — rules map `contest_name` + `county_name` from the candidate CSV to districts (e.g. `NC HOUSE OF REPRESENTATIVES DISTRICT 008` → `nc_house:8`; `PITT COUNTY BOARD OF COMMISSIONERS DISTRICT 2` → Pitt commissioner district 2; county-wide offices → the county). Unmatched contests are reported by the job, not silently dropped.

All files are from the NCSBE public bucket `https://s3.amazonaws.com/dl.ncsbe.gov/`.

## Validation spike: Google Civic `voterInfoQuery` (2026-10-03) — rejected as primary source

Google Civic was the first-choice free source for state/local races. A spike on 2026-10-03 (31 days before the 2026-11-03 general) tested 13 queries: 3 input formats and 10 public-building addresses in TX, CO, WA, OH, GA, MN, AZ, NC, PA, IA.

| Finding | Result |
|---|---|
| `/elections` | Lists `12000` — "2026 General Midterm Election", 2026-11-03 |
| Without `electionId` | Most addresses fail with `Election unknown`; zip-only and "City, ST" fail with `Failed to parse address` |
| With `electionId=12000` | Zip, `"lat,lng"`, and "City, ST" are accepted |
| Contests returned | **0 for every address** — only election, normalized address, and state election-office info |
| GA, IA | `404 No information for this address` |

Ballot data in this feed depends on election officials supplying it and was absent a month before a general election. Google Civic may be added later as an optional provider; it is not on the critical path.

## Options Considered

### Option A: Free sources behind a provider interface, keyed by OCD-ID; NC pilot from state election board data — Chosen

Real, authoritative, free data with full federal-to-local coverage in one state; FEC gives federal coverage everywhere. Each additional state requires its own adapter.

### Option B: Single commercial provider (BallotReady) — Deferred

Best coverage and least integration work; cost not justified until viability is proven. Designed to become an adapter later.

### Option C: Google Civic `voterInfoQuery` — Rejected as primary

See spike results above.

### Option D: Federal only (FEC + Census) — Rejected as the target, kept as the out-of-state behavior

Fails the federal-to-local goal, but is what users outside a pilot state will see.

## Consequences

- The `/api/districts` → `/api/races?districtIds=` flow is unchanged in shape; districts are created by ingestion instead of the seed script.
- The fictional seed candidates must not be loaded into production. `prisma/seed.ts` is split: news outlets (real reference data, required by the news scraper) vs. dev-only fixtures.
- Users outside NC see federal races only. The UI must say so plainly rather than implying completeness.
- NC state and local candidates get news-based enrichment only; the voting-record and campaign-finance scrapers are federal-only. (NC campaign finance data is public and is a candidate future enrichment source.)
- The NC setup job processes a file containing personal data; it must be run so that personal fields are discarded in-stream and never written to disk, logs, or the database.

## Risks

- **Split precincts.** Some precincts are divided between districts (most often municipal or commissioner boundaries). Such a precinct maps to more than one district of the same type; the dashboard must show both and say the voter's ballot may include either. A future refinement could use the NCSBE address-points file (`ShapeFiles/address_points_sboe.zip`) for address-level precision.
- **Contest-name matching** is rule-based and may miss unusual contest names. Mitigation: the job reports unmatched contests; tests cover each contest family.
- **File format drift.** NCSBE may change CSV columns or file names. Mitigation: the job validates headers and fails loudly.
- **Municipal elections are mostly in odd years in NC**, so 2026 has few city contests. Expected, not a defect.
- Census Geocoder has no published SLA. Mitigation: cache results; out-of-state lookups degrade to "no races found" rather than erroring.

## Slice 1 safeguards (from code and security review, 2026-10-03)

- **General elections only.** NCSBE primary rows share contest names across parties (distinguished by `party_contest`); grouping by name would put both parties' candidates on one ballot. Primaries are refused until `party_contest` is part of the race key.
- **Sub-district parentheticals.** Only `(UNEXPIRED)` and `(SPECIAL)` are ignored when classifying; any other parenthetical (e.g. `(WEST)`) leaves the contest unmatched rather than widening a district seat to a whole county or town.
- **Malformed input.** Rows whose field count differs from the header are dropped (columns are positional; a shift could publish contact details as a party). More than 10 malformed rows, or an unterminated quote, aborts the run. Party codes outside a known list are stored as null.
- **Mass withdrawal guard.** A run that would withdraw more than 10% (and more than 5) of an election date's active candidates stops unless `--force` is given. Only `active` candidates are withdrawn; `elected` is never changed. Elections the source stops listing are retired (status `concluded`).
- **Stale status.** `/api/races` filters on `electionDate >= today` in addition to stored status.
- **Census lookups** use coordinates rounded to 4 decimals (≈11 m) so the response cache can't be trivially bypassed. Per-IP rate limiting (ADR-006) is still outstanding and should be added at the edge.

## Open Questions

- Refresh cadence for the NC candidate file (it is updated as candidates withdraw or are replaced) — daily is assumed.
- Should split-precinct ambiguity be resolved by asking for a street address?
- Retention of concluded elections and their candidates after results are certified.
