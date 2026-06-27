# ADR-002: Database

**Date:** 2026-06-27
**Status:** Accepted

## Context

The candidateResearchApp requires a database that can handle the following data shapes and access patterns:

- Strongly relational data: candidates belong to elections, elections belong to districts, districts belong to jurisdictions. Rankings and scores must be computed across candidates within a race, and accessibility scores must be ranked across jurisdictions. These relationships are queried frequently and must be joined efficiently.
- Flexible structured data within a relational model: campaign finance filing records, voting record entries, and public statements have varied field sets depending on the jurisdiction. Some fields may be present for federal candidates but absent for local candidates.
- Geographic geometry: Census TIGER/Line shapefile boundaries must be stored and queried spatially as a fallback when the Cicero API is unavailable. A point-in-polygon query (`ST_Within`) must resolve a user's lat/lng coordinates to the correct district.
- Daily write load: the scraping pipeline writes thousands of rows per daily cycle across VotingRecord, CampaignFinanceRecord, NewsArticle, ScrapeJob, and CandidateRatings tables simultaneously from multiple worker processes.
- High read load: candidate profile pages and the rankings pages are read frequently. API response caching in Redis reduces database read pressure for the most popular endpoints.

The app is a personal project. Infrastructure must be simple to operate. Managed database offerings are acceptable.

## Decision

PostgreSQL is the primary database, with the PostGIS extension enabled for geographic queries used in the TIGER/Line district resolution fallback.

## Options Considered

### Option A: PostgreSQL + PostGIS — Chosen

PostgreSQL is a mature, well-supported relational database. Its data model is a direct fit for the candidate/race/district/jurisdiction hierarchy. JSONB columns handle fields that vary by jurisdiction without requiring schema changes for every new field shape. Full-text search, array columns, and strong indexing support are available natively. Transactions across multiple tables (e.g., writing a candidate's profile data and updating their `last_refreshed_at` atomically) work correctly and reliably.

PostGIS is a PostgreSQL extension that adds geographic data types and spatial query functions. Enabling it allows TIGER/Line shapefile geometry to be loaded directly into a `geometry` column on the `District` table. A single `ST_Within(point, geometry)` query resolves a user's lat/lng to the correct district row without a separate geographic data service. This is the fallback path when the Cicero API is unavailable — it must be fully functional and tested, not just a stub.

Managed PostgreSQL is available on Railway, Render, and DigitalOcean (all three PaaS candidates in ADR-005), keeping operations simple.

The main operational cost is schema migration management — changes to the data model require explicit migration scripts. Prisma Migrate or Drizzle Kit handles this, but it is a step that SQLite or a document database would not require.

### Option B: SQLite — Not chosen

SQLite has zero infrastructure requirements. For a personal project, this is a real advantage. Turso provides a managed SQLite offering with an HTTP edge interface.

SQLite was ruled out for two reasons. First, the daily scraping pipeline writes thousands of rows simultaneously from multiple BullMQ worker processes. SQLite's write concurrency model (one writer at a time, database-level locking) makes it a poor fit for concurrent write loads. Even with WAL mode, a pipeline writing to VotingRecord, CampaignFinanceRecord, NewsArticle, and ScrapeJob concurrently from separate workers is likely to produce contention and failures. Second, PostGIS does not exist for SQLite. The TIGER/Line shapefile fallback for district resolution requires spatial queries that SQLite cannot support natively. SpatiaLite exists but is significantly less capable and less well-documented than PostGIS, and is not available as a managed offering.

### Option C: MongoDB — Not chosen

MongoDB's document model could store each candidate's data as a single flexible document, accommodating variation in field availability across jurisdictions without a rigid schema.

MongoDB was ruled out because the data is fundamentally relational. Ranking candidates within a race, scoring jurisdictions relative to each other, and joining election → district → jurisdiction for display all require cross-document relationships. MongoDB can model these with references and `$lookup` aggregation, but this pattern is verbose, slower, and harder to reason about than a relational join. Transactions across multiple collections in MongoDB are supported but add complexity. Most critically, MongoDB has no equivalent of PostGIS — there is no path to storing and querying TIGER/Line shapefile geometry for the district resolution fallback. Choosing MongoDB would require a separate geographic data service, adding infrastructure that PostgreSQL + PostGIS eliminates.

## Consequences

- All relational data (Jurisdiction, District, Election, Candidate, VotingRecord, CampaignFinanceRecord, PublicStatement, LegalHistoryEntry, BusinessAffiliation, CandidateRatings, SentimentAnalysis, NewsArticle, GovernmentAccessibilityScore, ScrapingSource, ScrapeJob, OutletCategory, MethodologyVersion) lives in a single PostgreSQL instance.
- The PostGIS extension must be enabled at database provisioning time. Managed Postgres on Railway, Render, and DigitalOcean all support PostGIS — this must be confirmed for whichever platform is selected.
- TIGER/Line shapefiles must be downloaded, converted to GeoJSON or WKB, and loaded into the `District.geometry` column before the fallback lookup can be used. This is a setup step, not a runtime step.
- Schema migrations are required for all model changes. An ORM (Prisma or Drizzle — see Open Questions in technical design) manages migration history.
- Redis is used alongside PostgreSQL for the BullMQ queue backend and for API response caching. Redis does not store any persistent application data — Postgres is the sole source of truth for all persistent state.
- The daily scraping pipeline must use a connection pool (e.g., PgBouncer or the ORM's built-in pool) to manage concurrent writes from multiple BullMQ workers without exhausting Postgres connection limits.

## Tradeoffs

**Gained:**
- Relational model that is a natural fit for the candidate/race/district hierarchy
- JSONB columns for flexible per-jurisdiction field sets without schema proliferation
- PostGIS enables the TIGER/Line district resolution fallback within the same database — no separate geographic service required
- Strong transaction support for atomic multi-table writes during the scraping pipeline
- Managed offerings available on all target PaaS platforms
- Full-text search, array operators, and window functions available natively for rankings and score queries

**Given up:**
- Zero-infrastructure simplicity of SQLite
- Schema flexibility of a document database for varied field sets (mitigated by JSONB columns)
- Slightly higher operational cost compared to a file-based or embedded database

## Related ADRs

- ADR-005: Deployment Platform — PostgreSQL managed offering availability on Railway/Render/DigitalOcean is confirmed for all three options.
- ADR-007: District Resolution — PostGIS is required for the TIGER/Line fallback; this decision enables that fallback to live inside the primary database rather than a separate service.
