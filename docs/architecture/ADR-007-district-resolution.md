# ADR-007: District Resolution

**Date:** 2026-06-27
**Status:** Accepted

## Context

The candidateResearchApp's primary user entry point is location-based: a user provides their location (via browser geolocation or zip code entry), and the app resolves which voting districts they belong to. The resolved districts determine which races and candidates are shown on their dashboard. If district resolution is wrong, the user sees the wrong races — the most critical failure mode in the application.

District resolution in the United States is complex. A single address may fall within multiple overlapping districts simultaneously: a congressional district, state senate district, state house district, county commission district, city council district, school board district, and potentially a special district. The boundaries of these districts change after redistricting (roughly every ten years at the federal level, but at varying cadences for local districts). New districts are created, boundaries are adjusted, and district numbers are reassigned.

The app must resolve location to all applicable voting districts — not just federal and state, but also local. Supporting local races is a stated product goal. This makes resolution significantly harder than simply looking up a congressional district.

The `/api/locate` endpoint accepts either a lat/lng coordinate pair (from browser geolocation) or a zip code. It returns the list of districts and a confidence indicator.

## Decision

The Cicero API is the primary district resolution service. Census TIGER/Line shapefiles, loaded into PostgreSQL via PostGIS, serve as the fallback when Cicero is unavailable, returns an error, or times out. The fallback must be fully functional and tested — it is not a stub.

## Options Considered

### Option A: Cicero API (primary) + Census TIGER/Line via PostGIS (fallback) — Chosen

**Cicero API (primary)**

Cicero is a commercial API service specifically designed to resolve addresses and coordinates to voting districts across all levels of government in the United States. It covers federal, state, and local districts including congressional, state legislative, county, city, school district, and special districts. Cicero maintains its district data and keeps it current through redistricting cycles.

The Cicero API is called at request time from `/api/locate`. It is not called in batch during the scraping pipeline — districts are resolved on demand per user, not pre-resolved for all US addresses. This means Cicero is called at most once per unique user location session. Successful resolutions are cached in the `District` table by district ID so that repeat resolutions of the same geographic area do not require additional API calls. Redis caching on the `/api/locate` response further reduces repeat calls for similar coordinates.

Cicero is a paid service. The API key is stored as an environment variable and never committed to source control or returned to the client. Cicero's rate limits apply; the app's per-request (not batch) call pattern keeps volume manageable.

**Census TIGER/Line shapefiles via PostGIS (fallback)**

If Cicero is unavailable, times out, or returns no result, the app falls back to querying PostGIS directly. TIGER/Line shapefiles (published by the US Census Bureau) contain the boundary polygons for congressional districts, state legislative districts (both chambers), and county boundaries. These shapefiles are downloaded from the Census Bureau, converted to GeoJSON or WKB geometry, and loaded into the `District.geometry` column in PostgreSQL using PostGIS.

When the fallback is triggered, a `ST_Within(ST_SetSRID(ST_MakePoint(lng, lat), 4326), geometry)` query returns the district rows whose geometry contains the user's coordinates. The `/api/locate` response includes a `resolution_method: "tiger_fallback"` indicator, which the frontend can surface to users as a lower-confidence resolution.

The TIGER/Line fallback has known limitations: it does not cover all special district types (some require separate TIGER files), and its data is updated after redistricting rather than continuously. The fallback also does not cover city council districts and other hyper-local boundaries that Cicero resolves. These gaps are documented in the API response via `resolution_confidence: "low"` and surfaced in the UI's District Confirmation Panel (Screen 4), where users can review their resolved districts and flag potential errors.

**Combined approach justification**

No single data source resolves all district types reliably across all US jurisdictions. Cicero provides the best breadth and accuracy but introduces an external API dependency and cost. TIGER/Line is authoritative and free but requires infrastructure setup and does not cover all local district types. The combination — Cicero as primary, TIGER as fallback — provides the best balance of coverage, reliability, and cost control. Critically, the TIGER fallback means the app degrades gracefully rather than failing completely when Cicero is unavailable.

### Option B: Census TIGER/Line shapefiles only (no third-party API) — Not chosen

Using only TIGER/Line shapefiles hosted in PostGIS would eliminate the Cicero API dependency and cost. The Census Bureau publishes TIGER shapefiles for congressional districts, state legislative districts, county boundaries, school districts, and some special districts. These are authoritative, free, and can be loaded into PostGIS for spatial queries.

This option was not chosen as the primary approach because:
- TIGER/Line data must be manually downloaded, processed, and loaded. Updates after redistricting are not automatic — the database must be refreshed from new TIGER releases. Cicero manages this data currency automatically.
- TIGER/Line coverage for local districts is incomplete. City council districts, water districts, fire districts, and other special districts are inconsistently covered across shapefiles. Many local districts that determine which candidates a user sees on their dashboard would not be resolvable.
- Zip code to lat/lng conversion would require a separate geocoding service (Census Geocoder API or another service), adding a second dependency anyway.

TIGER/Line remains the fallback because its congressional, state legislative, and county coverage is authoritative and reliable. For the most common district types in the application, it is a credible fallback.

### Option C: Google Maps / Mapbox Geocoding APIs — Not chosen

Google Maps Platform and Mapbox both offer geocoding and some administrative boundary resolution. However, neither provides voting district resolution at the specificity required for this application. They can resolve an address to a county or city, but not to a state senate district, a school board district, or a special district. Using a general-purpose geocoding API for district resolution would require building and maintaining the boundary-to-district mapping ourselves — equivalent in complexity to loading TIGER/Line shapefiles, but with the added cost of the geocoding API.

Additionally, these services are general-purpose commercial products not specialized for civic district data. Cicero is purpose-built for this problem and maintains the district data that would otherwise have to be built and maintained internally.

## Consequences

- A Cicero API account and key must be obtained before the location resolution feature can be tested end-to-end. The key is stored as an environment variable.
- The PostGIS fallback requires a one-time setup step: downloading TIGER/Line shapefiles from the Census Bureau, converting them to the correct geometry format, and loading them into the `District.geometry` column. This must be scripted and repeatable so it can be re-run after redistricting.
- The `/api/locate` response always includes `resolution_method` (`"cicero"` or `"tiger_fallback"`) and `resolution_confidence` (`"high"` or `"low"`). The frontend District Confirmation Panel surfaces the confidence level to users and provides a path to manually review or override their resolved districts.
- Successful district resolutions from Cicero are cached in the `District` table by Cicero district ID. Redis caches the `/api/locate` response for a short TTL to avoid repeated Cicero calls for the same coordinates within a session.
- Zip code to coordinate conversion must be handled before calling Cicero or the PostGIS fallback. The Census Geocoder API or a free zip code centroid lookup table are options. This is a detail left to implementation — it is a lookup step, not a design decision.
- The TIGER/Line fallback coverage gaps (special districts, some local districts) must be documented and tested. The fallback must not return incorrect district assignments — returning no districts (with a clear message to the user) is preferable to returning wrong districts.
- Cicero's availability and rate limits must be monitored (Risk 4 in technical design). If Cicero changes its pricing model or availability terms, the TIGER/Line fallback buys time to evaluate alternatives.

## Tradeoffs

**Gained:**
- Cicero provides the broadest, most current district resolution coverage for all levels of US government without requiring the application to maintain district boundary data
- PostGIS fallback ensures the location flow degrades gracefully when Cicero is unavailable rather than failing completely
- TIGER/Line geometry stored in the application database enables spatial queries without an additional geographic service dependency
- Resolution method transparency (`resolution_method` in the API response) allows the frontend to communicate confidence level to users and provide a manual correction path

**Given up:**
- Full independence from a third-party API dependency for the core user entry point (Cicero is a commercial service with its own availability and pricing risks)
- Complete coverage of all local district types in the TIGER fallback (some special districts are not resolvable from TIGER/Line data)
- Simplicity of a single data source — the dual-source approach requires validating both paths and handling the response format differences between them

## Related ADRs

- ADR-002: Database — PostGIS is enabled on the PostgreSQL instance specifically to support the TIGER/Line district resolution fallback. This is one of the reasons SQLite was rejected.
- ADR-005: Deployment Platform — The PaaS platform must support PostgreSQL with PostGIS enabled.
- ADR-006: Authentication — District resolution is called anonymously on every user session; no user identity is needed for resolution.
