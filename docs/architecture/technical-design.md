# Technical Design Document

**Status:** Draft
**Date:** 2026-06-27
**Version:** 0.1
**Based on:** Business Process Discovery, Open Questions, Product Requirements, UX Design documents

---

## Recommended MVP Architecture

### Summary

A server-rendered web application with a lightweight JavaScript enhancement layer, backed by a relational database, a background job queue for daily data refresh, and a dedicated scraping pipeline. No user authentication. No client-side state beyond URL parameters and browser geolocation. All candidate data and scores are pre-computed and served from the database.

### Stack

| Layer | Recommendation | Rationale |
|---|---|---|
| Frontend | Next.js (React, SSR/SSG) | Server rendering for SEO and fast initial load; React for interactive components (popups, collapsible sections, comparison view) |
| Backend | Next.js API Routes | Keeps the stack minimal for MVP; avoids operating a separate API service |
| Database | PostgreSQL | Relational model fits candidate/race/district relationships; mature, well-supported, strong JSON column support for flexible structured data |
| Job Queue / Scheduler | BullMQ (Node.js, Redis-backed) | Reliable priority queue for the daily scraping pipeline; supports rate limiting, retries, and job status monitoring |
| Scraping Runtime | Node.js workers (via BullMQ worker processes) | Same language as the rest of the stack; sufficient for HTML parsing and HTTP fetching at MVP scale |
| Sentiment Analysis | Python microservice (called from the scraping pipeline) | NLP ecosystem in Python is significantly stronger than Node.js; isolated as a small internal service |
| Cache | Redis | Dual-purpose: BullMQ queue backend + API response cache for high-read endpoints (candidate profiles, rankings) |
| Hosting | Cloud VPS (e.g., Railway, Render, or a single DigitalOcean Droplet for MVP) | Simple to operate for a solo project; avoids Kubernetes/serverless complexity at MVP scale |
| Object Storage | S3-compatible storage (e.g., Cloudflare R2) | Store scraped raw HTML and collected article text for audit trail and re-processing |

### Why This Stack

The most critical constraint is that this is a personal project with limited operational capacity. The stack above concentrates complexity in one language (TypeScript/Node.js) except for the NLP pipeline, uses a single database that can handle all relational, JSON, and array data needs at MVP scale, and avoids microservice proliferation. The daily scrape is the heaviest operation — BullMQ with Redis gives rate-limit control, retry logic, and job visibility without requiring a managed queue service.

Server-side rendering is chosen over a pure SPA because: candidate profiles are read-only public content that benefits from SEO and fast first paint; no session state is needed; and shareable URLs (candidate profiles, comparison views) work natively without client-side routing workarounds.

---

## Options Considered

### Frontend Framework Options

#### Option A: Next.js (React, SSR/SSG) — Recommended

**Pros:** Strong SSR/SSG support; React ecosystem for interactive components; API routes reduce service count; large community; Vercel deployment if desired; file-based routing aligns with clean URL structure for candidate profiles.

**Cons:** React adds JavaScript weight for what is essentially a read-heavy content site; Next.js has build complexity and some sharp edges around caching.

**Why chosen:** The interactive requirements (modal popups, collapsible sections, two-column comparison, geolocation prompt, zip code fallback, candidate selection flow) justify React. SSR is the right choice for SEO and shareable URLs. Next.js bundles both concerns.

---

#### Option B: SvelteKit

**Pros:** Lighter bundle size than React; excellent SSR support; simpler component model; TypeScript support.

**Cons:** Smaller ecosystem; fewer UI component libraries; less familiarity if other contributors join.

**Tradeoff:** Technically competitive with Next.js and arguably better suited to a mostly-read app. Worth considering if bundle size becomes a concern. Deferred for MVP — Next.js ecosystem is better documented for this pattern.

---

#### Option C: Plain HTML + HTMX (no JS framework)

**Pros:** Minimal JavaScript; fast; no build tooling; easiest to reason about for a read-only app.

**Cons:** Modal popups (rating explanations), the two-column comparison view, and the comparison candidate-selection flow all require significant JS. HTMX can handle some of this but becomes awkward for a multi-panel comparison layout and the geolocation API interaction.

**Tradeoff:** Ruled out because the interactive requirements are too significant for a no-framework approach to remain clean. The comparison view and rating popup flow genuinely benefit from a component model.

---

### Backend Options

#### Option A: Next.js API Routes (same process as frontend) — Recommended for MVP

**Pros:** One deployment unit; zero additional infrastructure for MVP; TypeScript throughout.

**Cons:** API routes and frontend share the same process — a heavy scraping pipeline could starve the API. Mitigated by running the scraping pipeline in separate worker processes (BullMQ workers), not inside API routes.

---

#### Option B: Separate Express / Fastify API server

**Pros:** Clear separation between frontend and data API; independently scalable.

**Cons:** Adds a second service to deploy and maintain; premature for a personal project MVP.

**Tradeoff:** The right choice if the product reaches significant scale. Not the right choice for MVP.

---

#### Option C: Serverless Functions (Vercel, AWS Lambda, Cloudflare Workers)

**Pros:** No server management; scales to zero; low cost at low traffic.

**Cons:** The long-running scraping pipeline cannot live in a serverless function. Background jobs require a separate queue worker anyway, eliminating much of the benefit. Cold starts add latency to the first API call after inactivity. Streaming responses for large candidate datasets are awkward.

**Tradeoff:** Inappropriate for this workload. The app is a data pipeline + read API; serverless fits the read side but not the pipeline.

---

### Database Options

#### Option A: PostgreSQL — Recommended

**Pros:** Relational model is a natural fit for candidate/race/district/score relationships. JSONB columns handle flexible structured data (e.g., campaign finance filings, voting record entries). Strong indexing, transactions, and full-text search. Best-in-class for this data shape.

**Cons:** Requires managing a Postgres instance (though managed offerings are cheap). Schema migrations must be managed explicitly.

---

#### Option B: SQLite (via Turso or local file)

**Pros:** Zero infrastructure; trivially simple for a personal project.

**Cons:** Poor fit for concurrent write loads (the daily scrape writes thousands of rows simultaneously). Limited JSON querying. Difficult to inspect and query during development.

**Tradeoff:** Not suitable for the write volume of a daily full scrape across thousands of candidates.

---

#### Option C: MongoDB (document database)

**Pros:** Flexible schema; natural for varied candidate data shapes.

**Cons:** Candidate/race/district relationships are inherently relational — a document database forces denormalization that makes queries for rankings and scores awkward. Transactions across collections are cumbersome. Over-engineered for this pattern.

**Tradeoff:** The relational model is clearly the better fit. MongoDB would make the rankings queries and score aggregations significantly harder.

---

### Scraping Architecture Options

#### Option A: Node.js workers via BullMQ — Recommended

**Pros:** Same runtime as the rest of the stack; BullMQ provides rate limiting, retry, priority, and job visibility out of the box; Redis is already in the stack for caching; can be scaled horizontally by adding worker processes.

**Cons:** Node.js is single-threaded; CPU-intensive HTML parsing at high volume could block. Mitigated by running workers as separate processes.

---

#### Option B: Python Scrapy / Celery

**Pros:** Scrapy is purpose-built for web scraping with built-in middleware for rate limiting, robots.txt compliance, and retry.

**Cons:** Introduces a second runtime (Python) for scraping when the NLP service already uses Python — consolidation is reasonable, but Scrapy's output needs to be written to Postgres from Python, adding coupling. More operational complexity.

**Tradeoff:** If the scraping pipeline becomes complex enough to warrant Scrapy's middleware ecosystem, migrating to Python Scrapy/Celery is a reasonable next step. Not necessary for MVP.

---

#### Option C: Third-party scraping services (Apify, Brightdata, ScrapingBee)

**Pros:** Managed infrastructure; handles IP rotation, CAPTCHA, proxying.

**Cons:** Cost at scale; dependency on a third-party service for a civic data pipeline is a business risk; reduces visibility into what is actually being collected.

**Tradeoff:** May be useful for specific problem sources. Not a primary architecture choice.

---

### Sentiment Analysis Options

#### Option A: Hugging Face Transformers (local Python microservice) — Recommended

**Pros:** No per-call API cost; full control over model and methodology; runs offline; auditable; consistent versioning of the model used for analysis. A documented model version can be cited in the methodology page.

**Recommended model:** `cardiffnlp/twitter-roberta-base-sentiment-latest` (fine-tuned for news/political text sentiment) or `ProsusAI/finbert` adapted for political text. Model selection should be validated against a sample of political news articles before committing.

**Cons:** Requires GPU or CPU inference at scale — CPU inference is slow. For MVP scale (hundreds of articles per day, not millions), CPU inference is acceptable.

---

#### Option B: OpenAI API (GPT-4o or similar)

**Pros:** No model hosting; high quality out of the box; handles nuance well.

**Cons:** Per-call cost at scale is significant (50+ articles per candidate × thousands of candidates = substantial volume); dependency on a third-party API with usage policies; reproducibility concern — the model can be updated without notice, changing results for the same article; harder to cite in methodology as a reproducible methodology.

**Tradeoff:** Suitable as a quick proof-of-concept or for low-volume testing. Not suitable as the production sentiment engine due to cost, dependency, and methodology reproducibility concerns.

---

#### Option C: Google Cloud Natural Language API / AWS Comprehend

**Pros:** Managed; no model hosting; reliable.

**Cons:** Per-call cost; same reproducibility concerns as Option B; less control over what the model considers "positive" vs. "negative" in a political context. Harder to document as a transparent, reproducible methodology.

**Tradeoff:** Same concerns as Option B. Managed NLP APIs are not appropriate for a product where methodology transparency is a core value proposition.

---

### Deployment Options

#### Option A: Single VPS / PaaS (Railway, Render, DigitalOcean App Platform) — Recommended for MVP

**Pros:** Simple; one environment to manage; low cost at MVP traffic levels; managed Postgres and Redis available on all three platforms.

**Cons:** Vertical scaling only until the app is restructured; single region.

**Why chosen:** This is a personal project. Operational simplicity is more important than theoretical scalability for MVP.

---

#### Option B: AWS / GCP / Azure (managed Kubernetes or ECS)

**Pros:** Highly scalable; well-documented; all services available.

**Cons:** Significant operational complexity for a solo project; cost overhead; over-engineered for MVP scale.

**Tradeoff:** Appropriate if the product grows to significant traffic. Not the right starting point.

---

#### Option C: Vercel (for Next.js) + separate Postgres/Redis

**Pros:** Vercel is purpose-built for Next.js; zero-config deployment; excellent CDN.

**Cons:** The long-running scraping pipeline and BullMQ worker cannot run on Vercel (serverless function timeout limits). Would require a separate hosting environment for the pipeline, splitting the deployment into two environments.

**Tradeoff:** Vercel is attractive for the web layer but does not support the pipeline. Unless deploying the pipeline to a separate service is acceptable, Vercel alone is not sufficient.

---

## Tradeoffs

| Decision | Chosen Approach | Key Tradeoff |
|---|---|---|
| Frontend | Next.js (SSR) | Slightly heavier than SvelteKit; better ecosystem and community support |
| Backend | Next.js API routes | Shared process with frontend; pipeline runs in separate workers to isolate it |
| Database | PostgreSQL | Requires managed instance; far better fit than document databases for relational candidate data |
| Scraping | BullMQ + Node.js workers | Same runtime as the app; not as purpose-built as Scrapy but sufficient for MVP |
| Sentiment | Local Python microservice | Requires model hosting; eliminates per-call cost and enables methodology reproducibility |
| Deployment | PaaS (Railway/Render/DO) | Simpler than cloud-native but less scalable; correct tradeoff for a personal MVP |
| No auth | Anonymous, no accounts | Eliminates user management entirely; creates no session or PII storage; simplifies security model |

---

## Data Model

This is a logical model — not a full SQL schema. Field names are descriptive, not necessarily final column names.

---

### Core Entities

#### Jurisdiction

Represents a geographic government unit at any level.

| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | "Colorado", "Denver County", "Denver Public Schools" |
| type | Enum | federal, state, county, city, school_district, special_district |
| parent_id | UUID (nullable) | References another Jurisdiction (e.g., county's parent is state) |
| fips_code | String (nullable) | Census FIPS code for matching to geographic data |
| cicero_id | String (nullable) | Cicero API reference ID |
| election_officials_url | String (nullable) | Link to jurisdiction's election officials page |
| election_officials_contact_url | String (nullable) | Direct contact page |

---

#### District

A specific electoral district within a jurisdiction. A jurisdiction may contain many districts (e.g., multiple state senate districts within a state).

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| jurisdiction_id | UUID | Foreign key to Jurisdiction |
| name | String | "US House — District 7", "State Senate District 22" |
| level | Enum | federal, state, local |
| district_type | String | "congressional", "state_senate", "state_house", "county_commission", etc. |
| cicero_district_id | String (nullable) | Cicero API reference |
| shapefile_reference | String (nullable) | Reference to Census TIGER/Line geometry if Cicero is unavailable |
| geometry | GeoJSON (JSONB, nullable) | Stored boundary polygon for fallback lookup |

---

#### Election

A specific election event.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| district_id | UUID | Foreign key to District |
| name | String | "2026 Colorado U.S. Senate General Election" |
| election_type | Enum | primary, general, special |
| election_date | Date | |
| filing_deadline | Date (nullable) | |
| status | Enum | upcoming, active, concluded |
| election_cycle_start | Date | Start of the relevant election cycle for this office (used for sentiment lookback period) |
| created_at | Timestamp | |
| updated_at | Timestamp | |

---

#### Candidate

A person running in an election.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| election_id | UUID | Foreign key to Election |
| full_name | String | |
| party | String (nullable) | "D", "R", "I", "L", "G", etc. |
| status | Enum | active, withdrawn, elected |
| is_incumbent | Boolean | Used for Factual Consistency Score rule |
| profile_slug | String (unique) | Stable URL segment: e.g., "jane-smith-co-us-senate-2026" |
| official_website_url | String (nullable) | Candidate's own site — labeled as self-promotional, not used as factual source |
| last_refreshed_at | Timestamp (nullable) | Last successful data refresh |
| data_is_stale | Boolean | True if last_refreshed_at > 24 hours ago |
| has_limited_data | Boolean | True if profile data completeness is below meaningful threshold |
| created_at | Timestamp | |
| updated_at | Timestamp | |

---

#### CandidateProfile

The collected factual data for a candidate. Stored as a set of structured entries rather than a single JSON blob, so individual fields can carry their own source links.

##### VotingRecord

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| candidate_id | UUID | |
| bill_or_measure | String | "S.123 — Clean Energy Act" |
| vote | Enum | yea, nay, abstain, absent, present |
| vote_date | Date | |
| source_url | String | Link to authoritative government record |
| source_available | Boolean | False if the URL is broken/404 |
| collected_at | Timestamp | |

##### CampaignFinanceRecord

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| candidate_id | UUID | |
| filing_period | String | "Q3 2025", "Pre-Election October 2025" |
| total_raised | Decimal (nullable) | |
| individual_donor_pct | Decimal (nullable) | |
| pac_donor_pct | Decimal (nullable) | |
| party_transfer_pct | Decimal (nullable) | |
| total_spent | Decimal (nullable) | |
| filing_complete | Boolean | Whether all legally required filings exist |
| source_url | String | FEC or state equivalent link |
| source_available | Boolean | |
| collected_at | Timestamp | |

##### PublicStatement

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| candidate_id | UUID | |
| statement_excerpt | Text | |
| statement_date | Date | |
| source_type | String | "Senate transcript", "Official press release", "Government hearing record" |
| source_url | String | |
| source_available | Boolean | |
| collected_at | Timestamp | |

##### LegalHistoryEntry

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| candidate_id | UUID | |
| case_type | String | "Civil", "Criminal", "Administrative" |
| case_date | Date | |
| jurisdiction | String | Court / jurisdiction name |
| outcome | String (nullable) | "Dismissed", "Settled", "Convicted", "Acquitted", etc. |
| source_url | String | |
| source_available | Boolean | |
| collected_at | Timestamp | |

##### BusinessAffiliation

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| candidate_id | UUID | |
| entity_name | String | |
| role | String | "Member", "Director", "Officer", "Registered Agent" |
| state_of_registration | String | |
| source_url | String | |
| source_available | Boolean | |
| collected_at | Timestamp | |

---

#### CandidateRatings

Computed scores stored per candidate after each refresh cycle.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| candidate_id | UUID | |
| computed_at | Timestamp | |
| transparency_score | Integer (nullable) | 0–100; null if insufficient data (<5 data points) |
| transparency_data_completeness | Integer (nullable) | Component: 0–40 |
| transparency_finance_compliance | Integer (nullable) | Component: 0–30 |
| transparency_record_depth | Integer (nullable) | Component: 0–20 |
| transparency_data_currency | Integer (nullable) | Component: 0–10 |
| transparency_limited_data | Boolean | |
| factual_consistency_score | Integer (nullable) | 0–100; null if < 10 votes (and not incumbent) or < 5 data points |
| factual_consistency_new_candidate | Boolean | True if fewer than 10 votes and not incumbent |
| campaign_finance_score | Integer (nullable) | 0–100; null if < 5 data points |
| campaign_finance_filing_complete | Boolean (nullable) | |
| campaign_finance_accuracy_issue | Boolean (nullable) | True if donation/expenditure discrepancy found |

---

#### SentimentAnalysis

Sentiment scores per candidate per outlet category per article batch.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| candidate_id | UUID | |
| outlet_category | Enum | conservative, liberal, neutral |
| article_count | Integer | Number of articles analyzed for this candidate/category |
| sentiment_result | Enum (nullable) | positive, neutral, negative; null if below threshold |
| insufficient_data | Boolean | True if article_count < 50 |
| coverage_period_start | Date | Start of the last election cycle for this office |
| coverage_period_end | Date | Date of analysis run |
| computed_at | Timestamp | |

---

#### NewsArticle

Individual articles collected and analyzed.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| candidate_id | UUID | |
| url | String | Original article URL |
| outlet_name | String | "New York Times", "Fox News", etc. |
| outlet_category | Enum | conservative, liberal, neutral |
| published_at | Date | |
| headline | String | |
| raw_text_key | String (nullable) | S3-compatible object key for stored article text |
| sentiment_score | Float (nullable) | Raw model output score |
| sentiment_label | Enum (nullable) | positive, neutral, negative |
| analyzed_at | Timestamp (nullable) | |
| collected_at | Timestamp | |

---

#### GovernmentAccessibilityScore

Scores for each jurisdiction's data accessibility.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| jurisdiction_id | UUID | |
| election_cycle | String | "2026" — scored once per cycle |
| total_score | Integer | 0–100 |
| filing_data_public | Boolean | |
| filing_data_machine_readable | Boolean | |
| filing_data_free | Boolean | |
| filing_data_timely | Boolean | |
| voting_records_available | Boolean | |
| voting_records_structured | Boolean | |
| campaign_finance_detail | Enum | full, partial, none |
| robots_txt_restriction | Boolean | True if robots.txt blocks public election data paths |
| robots_txt_restricted_paths | Array[String] (nullable) | Specific blocked paths |
| no_public_sources_at_all | Boolean | True if no data exists whatsoever |
| scored_at | Timestamp | |
| notes | Text (nullable) | Manual notes on scoring decisions |

---

#### ScrapingSource

Registry of all sources the pipeline scrapes, with per-source configuration and ToS/robots.txt status.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| jurisdiction_id | UUID (nullable) | Which jurisdiction this source covers |
| source_type | Enum | election_board, campaign_finance, voting_records, court_records, business_registry, news |
| base_url | String | Root domain |
| robots_txt_checked_at | Timestamp | |
| robots_txt_allows_scraping | Boolean | Whether the relevant paths are allowed |
| robots_txt_disallowed_paths | Array[String] | Paths we must not scrape |
| tos_reviewed | Boolean | Whether ToS has been manually reviewed |
| tos_review_notes | Text (nullable) | Notes from ToS review |
| tos_reviewed_at | Timestamp (nullable) | |
| rate_limit_delay_ms | Integer | Milliseconds between requests to this source |
| is_active | Boolean | Whether this source is enabled in the pipeline |
| last_scraped_at | Timestamp (nullable) | |
| created_at | Timestamp | |

---

#### ScrapeJob

Individual job records created by the scheduler and processed by BullMQ workers.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| bullmq_job_id | String | BullMQ internal job ID |
| candidate_id | UUID (nullable) | If this is a candidate data job |
| source_id | UUID | Which ScrapingSource this job targets |
| job_type | Enum | candidate_profile, sentiment_articles, accessibility_score |
| status | Enum | queued, running, completed, failed, skipped |
| started_at | Timestamp (nullable) | |
| completed_at | Timestamp (nullable) | |
| error_message | Text (nullable) | If failed |
| records_written | Integer (nullable) | |
| created_at | Timestamp | |

---

#### OutletCategory

Lookup table for the news outlet categorization reference.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| outlet_name | String | Canonical outlet name |
| outlet_domain | String | Domain for URL-based categorization |
| category | Enum | conservative, liberal, neutral |
| categorization_source | String | Citation for the classification (e.g., "Groseclose & Milyo (2005)", "AllSides Media Bias Ratings") |
| added_at | Date | |
| last_reviewed_at | Date | |
| notes | Text (nullable) | |

---

#### MethodologyVersion

Tracks methodology page versions for citation purposes.

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| version | String | "1.0", "1.1", etc. |
| published_at | Date | |
| changelog | Text | What changed from the previous version |
| content_hash | String | Hash of the methodology page content — allows programmatic detection of changes |

---

### Entity Relationships (Summary)

```
Jurisdiction (1) --> (many) District
District (1) --> (many) Election
Election (1) --> (many) Candidate
Candidate (1) --> (many) VotingRecord
Candidate (1) --> (many) CampaignFinanceRecord
Candidate (1) --> (many) PublicStatement
Candidate (1) --> (many) LegalHistoryEntry
Candidate (1) --> (many) BusinessAffiliation
Candidate (1) --> (1) CandidateRatings (latest)
Candidate (1) --> (many) SentimentAnalysis (one per outlet category)
Candidate (1) --> (many) NewsArticle
Jurisdiction (1) --> (many) GovernmentAccessibilityScore (one per election cycle)
Jurisdiction (1) --> (many) ScrapingSource
ScrapingSource (1) --> (many) ScrapeJob
```

---

## API or Integration Design

### Internal API

All API routes are Next.js API routes served under `/api/`. These are internal — no public third-party API is exposed at MVP.

#### Geolocation / District Resolution

```
POST /api/locate
  Body: { lat: number, lng: number }
  OR:   { zip: string }
  Returns: {
    districts: District[],
    jurisdiction_name: string,
    resolution_confidence: "high" | "low",
    resolution_method: "cicero" | "tiger_fallback"
  }
```

The `/api/locate` endpoint calls the Cicero API internally. If Cicero fails or returns no result, it falls back to querying stored TIGER/Line shapefile geometry in Postgres using PostGIS.

---

#### Race and Candidate Dashboard

```
GET /api/races?district_ids=id1,id2,...
  Returns: {
    races: [{
      id, name, election_type, election_date, status,
      district: { id, name, level },
      candidates: [{ id, full_name, party, status, profile_slug }]
    }],
    last_refreshed_at: timestamp
  }
```

---

#### Candidate Profile

```
GET /api/candidates/:slug
  Returns: {
    candidate: { id, full_name, party, status, is_incumbent, official_website_url,
                 last_refreshed_at, data_is_stale, has_limited_data },
    election: { name, district, election_type, election_date },
    ratings: CandidateRatings,
    sentiment: SentimentAnalysis[],
    voting_record: VotingRecord[],
    campaign_finance: CampaignFinanceRecord[],
    public_statements: PublicStatement[],
    legal_history: LegalHistoryEntry[],
    business_affiliations: BusinessAffiliation[],
    data_source_accessibility: { jurisdiction, score, last_scored }
  }
```

---

#### Candidate Comparison

```
GET /api/compare?candidates=slug1,slug2
  Returns: {
    candidates: [CandidateProfile, CandidateProfile]
  }
```

The comparison URL is encoded as `/compare/slug1/slug2` — stable and shareable.

---

#### State Accessibility Rankings

```
GET /api/accessibility/states
  Returns: {
    rankings: [{ jurisdiction, score, rank, robots_txt_restriction, last_scored }],
    methodology_version: string
  }
```

---

#### Local Government Accessibility Rankings

```
GET /api/accessibility/local?state_fips=:code
  Returns: {
    jurisdictions: [{ id, name, type, score, rank, last_scored }]
  }
```

---

#### Accessibility Detail

```
GET /api/accessibility/:jurisdiction_id
  Returns: GovernmentAccessibilityScore (full detail)
```

---

### Third-Party Integrations

#### Cicero API

- **Purpose:** Primary district resolution from lat/lng or zip code
- **Call pattern:** Called at request time from `/api/locate`. Not called in batch during the scraping pipeline (districts are resolved on demand per user, not pre-resolved for all US addresses).
- **Failure handling:** If Cicero returns an error or timeout, fall back to PostGIS query against stored TIGER/Line geometry.
- **Data stored:** District IDs and names returned by Cicero are cached in the `District` table to avoid redundant API calls for the same coordinates.
- **API key:** Stored as an environment variable. Never committed to source control.
- **Rate limits:** Cicero's rate limits apply. The app does not batch-call Cicero; each user-triggered locate request is a single call.

---

#### Census TIGER/Line Shapefiles (Fallback)

- **Purpose:** District boundary geometry for fallback when Cicero is unavailable
- **Integration pattern:** Shapefiles are downloaded from the Census Bureau, converted to GeoJSON, and loaded into Postgres with PostGIS geometry columns. A `ST_Within(point, geometry)` query resolves the user's coordinates to districts.
- **Update cadence:** Updated after redistricting (typically post-decennial census). Not updated daily.
- **Scope:** Congressional districts, state legislative districts (both chambers), county boundaries. School districts and special districts may require separate TIGER files.
- **Limitation:** TIGER/Line does not cover all special district types. Some local races may not be resolvable via TIGER fallback.

---

#### News Sources (Scraping for Sentiment)

- **Integration pattern:** HTML scraping via HTTP fetch + HTML parser. No news API (to avoid per-call cost and to maintain independence from API providers who may restrict political content).
- **robots.txt compliance:** Before adding any news source to the `ScrapingSource` table, the scraper validates the source's robots.txt and records allowed/disallowed paths.
- **ToS risk:** Open question — each news outlet's Terms of Service must be individually reviewed before including it in the pipeline. This is a legal gate, not just a technical one. See Risks section.
- **Article discovery:** RSS feeds are the preferred discovery mechanism (public, structured, no login). If no RSS feed is available, the outlet's archive or tag pages are scraped for URLs.
- **Rate limiting:** Per-source rate limit configuration stored in `ScrapingSource.rate_limit_delay_ms`.

---

#### FEC API (Campaign Finance — Federal Candidates)

- **Integration pattern:** FEC provides a public REST API (`api.fec.gov`) — no scraping needed for federal candidates.
- **Data available:** Filing receipts, expenditures, committee registrations.
- **API key:** Required but free for public access. Stored as environment variable.
- **State-level campaign finance:** Scraped from state-specific disclosure sites. No unified state API exists.

---

#### Congress.gov (Voting Records — Federal Candidates)

- **Integration pattern:** Congress.gov provides structured data and an API for Congressional voting records.
- **Alternative:** GovTrack.us provides structured JSON voting data and is more scraping-friendly.
- **State legislative voting records:** State-specific scrapers required. Coverage varies significantly by state.

---

## Scraping Architecture

### Overview

The scraping pipeline runs daily via a scheduled cron job that enqueues tasks into BullMQ. Worker processes consume these tasks and write results to Postgres. Scraped raw content is stored in S3-compatible object storage for audit and re-analysis.

### Pipeline Stages

```
[Daily Cron Trigger]
        |
        v
[Job Enqueuer] — reads all active Candidates and ScrapingSources
        |
        v — enqueues jobs into BullMQ queues
        |
  +---------+--------+-----------+
  |         |        |           |
  v         v        v           v
[Govt   [Campaign  [Voting   [News Article
 Data    Finance   Records   Collection
 Worker] Worker]   Worker]   Worker]
  |         |        |           |
  v         v        v           v
[Postgres — writes structured records with source URLs]
[S3 — stores raw HTML/text for audit]
        |
        v
[Score Computation Worker]
  - Reads collected data
  - Computes CandidateRatings (Transparency, Campaign Finance, Factual Consistency)
  - Calls Python Sentiment Service for articles collected today
  - Writes CandidateRatings and SentimentAnalysis records
        |
        v
[Staleness Updater]
  - Sets data_is_stale = true on any Candidate not refreshed today
  - Sets stale flag on dashboard data_freshness indicator
```

---

### robots.txt Compliance

robots.txt compliance is enforced at two levels:

**Level 1 — Source onboarding:** Before adding any site to the `ScrapingSource` table, the source's robots.txt must be fetched and parsed. Disallowed paths are stored in `robots_txt_disallowed_paths`. Any source where the relevant data paths are disallowed is not scraped and is instead marked with `robots_txt_allows_scraping = false`. This restriction is counted against the jurisdiction's Data Accessibility Score.

**Level 2 — Runtime check:** The BullMQ workers re-fetch robots.txt for each source once per scraping cycle (not per request). If a previously allowed path is newly disallowed, the job is skipped and an alert is logged. A source's robots.txt is never cached indefinitely — it is checked fresh at the start of each daily cycle.

**Implementation:** The `robots-parser` npm package parses robots.txt and checks path-level rules including `User-agent: *` and crawl delay directives.

---

### Rate Limiting

Rate limiting is enforced per source. The `rate_limit_delay_ms` field in `ScrapingSource` defines the minimum delay between consecutive requests to that source. BullMQ's built-in rate limiter is used at the queue level, with per-source queue instances so that a slow source does not block faster sources.

Additional safeguards:
- Respect `Crawl-delay` directives in robots.txt
- Exponential backoff on 429 (rate limit) and 503 responses
- Maximum retry count of 3 before marking the job as failed

---

### Raw Content Storage

All scraped HTML and article text is stored in S3-compatible object storage (e.g., Cloudflare R2). Keys follow the pattern: `{source_type}/{jurisdiction_id}/{candidate_id}/{date}/{url_hash}.html`. This enables:
- Audit of what was scraped and when
- Re-processing with an updated model without re-scraping
- Debugging when a data point is questioned

---

### Error Handling and Monitoring

- Failed jobs are retried up to 3 times with exponential backoff
- Jobs that fail all retries are moved to a dead-letter queue for manual inspection
- A daily pipeline health check runs after the scraping cycle completes and logs:
  - Total jobs completed / failed / skipped
  - Any source where robots.txt changed since last cycle
  - Any candidate profile that could not be refreshed
  - Whether `data_is_stale` was set on any candidates

The BullMQ dashboard (Bull Board, or a custom admin page) provides visibility into queue depth, job status, and failure logs. This is an internal tool — not exposed to public users.

---

### Accessibility Score Pipeline

The Government Data Accessibility Score pipeline runs separately from the candidate data pipeline. It is triggered once per election cycle (not daily).

```
[Election Cycle Trigger — manual or scheduled]
        |
        v
[Accessibility Evaluator Worker]
  - Fetches robots.txt for each ScrapingSource
  - Evaluates each scoring criterion
  - Checks for structured data vs. PDF-only
  - Checks for free vs. paid/auth-required access
  - Computes GovernmentAccessibilityScore for each Jurisdiction
        |
        v
[Postgres — writes GovernmentAccessibilityScore records]
```

Some scoring criteria (e.g., "Is data timely?", "Is campaign finance detail sufficient?") require human judgment and will be flagged for manual review. The automation handles deterministic criteria; judgment calls are reviewed and entered manually via the `notes` field.

---

## Sentiment Analysis Approach

### Overview

News articles are collected by the scraping pipeline and stored. A separate Python microservice processes the collected articles and returns sentiment scores. This separation keeps the NLP environment (Python, ML libraries) isolated from the Node.js application.

### Outlet Categorization

Outlets are categorized in the `OutletCategory` table using textbook political science definitions documented on the methodology page. The categorization list is:
- Curated manually by the app owner, not derived from a third-party service
- Based on cited academic sources (e.g., Groseclose & Milyo ADA-based scoring, Pew Research Center political typology, peer-reviewed political communication literature)
- Static until manually reviewed and updated — not dynamically reassigned
- Applied uniformly to all candidates regardless of party

Open question: Process for keeping the categorization list current as outlets change is not yet defined. See Open Questions section.

### Article Collection

1. For each candidate in the database, the pipeline searches each categorized news outlet's RSS feed or archive pages for articles mentioning the candidate's name
2. Articles are filtered by publication date: only articles from within the last election cycle for the candidate's office are included
3. Duplicate URLs are deduplicated before processing
4. Article text is fetched (subject to robots.txt compliance and rate limiting), stripped of navigation and ad content (boilerplate stripping via the `@mozilla/readability` npm package or Python `newspaper3k`), and stored in S3
5. Articles are associated with the candidate via the `NewsArticle` table

### Sentiment Scoring

1. The daily pipeline enqueues a sentiment analysis job after article collection completes
2. The Python microservice is called via HTTP from the Node.js pipeline worker
3. The microservice loads articles from S3 (batch processing), runs inference, and returns `{ url, sentiment_label, sentiment_score }` per article
4. Results are written to `NewsArticle.sentiment_label` and `NewsArticle.sentiment_score`
5. Per-outlet-category aggregation is computed in Postgres: article count and majority sentiment label per `(candidate_id, outlet_category)` pair
6. The aggregated result is written to `SentimentAnalysis`

### Threshold Enforcement

Before writing a `SentimentAnalysis` record, the pipeline checks whether `article_count >= 50`. If not, `sentiment_result` is set to null and `insufficient_data` is set to true. The API returns this state to the frontend, which renders "Insufficient coverage data" for that outlet category.

### Model Versioning

The Python microservice reports the model name and version in its response. The model version is logged in the `SentimentAnalysis` record via a metadata field. This enables the methodology page to cite a specific model version and allows re-processing when the model is updated.

### Political Sentiment Calibration Risk

Standard sentiment models (trained on product reviews or general news) do not perform well on political text without fine-tuning. The chosen model must be evaluated against a labeled sample of political news articles before production use. If off-the-shelf model performance is insufficient, fine-tuning on a labeled political news dataset must be considered. This is a technical risk — see Risks section.

---

## Data Accessibility Scoring

### Methodology

Each jurisdiction is evaluated against the following criteria:

| Criterion | Points Weight (approximate) | Evaluation Method |
|---|---|---|
| Candidate filing data is publicly available | High | Check if candidate list exists at all |
| Filing data is machine-readable (not PDF-only) | High | Detect structured data vs. PDF |
| Filing data is accessible without authentication or fees | Medium | Check for login/paywall |
| Filing data is updated in a timely manner | Medium | Check publication date of latest data |
| Voting records are available and structured | High | Detect structured vote record data |
| Campaign finance is published with sufficient detail | Medium | Check for donor and expenditure detail |
| robots.txt does not restrict programmatic access to public election data | Medium | robots.txt parse result |
| No public data sources exist at all | Severe penalty — scores near 0 | Used when no usable data found |

### Benchmarking

Scores are calibrated relative to the best- and worst-performing jurisdictions:
- The jurisdiction(s) with the highest raw criterion pass count anchor the 100-point end
- The jurisdiction(s) with no accessible public data anchor near 0
- All other jurisdictions are scored proportionally based on how many criteria they meet relative to those anchors
- This is a relative benchmark — a state's score can change across election cycles if the benchmark anchors change

### Scoring Cadence

Scored once per election cycle. The `scored_at` timestamp and `election_cycle` string are stored in `GovernmentAccessibilityScore`. A stale-data indicator is shown on the accessibility detail page if the score has not been updated within the current cycle.

### robots.txt Restriction as a Scored Criterion

If a jurisdiction's source site uses robots.txt to disallow programmatic access to public election data paths, this is counted as a negative criterion. The specific disallowed paths are stored and surfaced on the accessibility detail page with a plain-language explanation: the jurisdiction is actively restricting programmatic access to public election records, and voters are entitled to know this.

### Local Government Coverage

Local governments (county, city, school district, special district) are scored using the same criteria and methodology as states. Due to the volume of local governments, the automated pipeline covers the most common data sources (state-published local filing systems, known local election board websites). Gaps in local coverage result in "no data available" scores for jurisdictions the pipeline has not yet catalogued.

---

## Authentication and Authorization

### MVP Decision: No Authentication Required

There are no user accounts, no login, no session management, and no access-controlled resources for MVP. Every page and every API endpoint is publicly accessible without credentials.

### Architectural Implications

- No session middleware required
- No cookie-based auth required
- No JWT or OAuth integration required
- No user table in the database
- No role-based access control
- No CSRF protection needed for read-only GET endpoints (the only write-path is the internal scraping pipeline, which runs in worker processes, not through the public API)

### What This Means for Security

Absence of authentication simplifies the security model significantly but does not eliminate all risk:
- API rate limiting is still needed to prevent abuse of the `/api/locate` endpoint (which calls the Cicero API, which has its own rate limits and cost)
- Input validation on the zip code endpoint is still required to prevent invalid input and injection
- The Cicero API key and all other secrets must never be exposed to the client

### Internal Pipeline Security

The scraping pipeline and score computation workers run as separate processes on the server — they do not expose HTTP endpoints. They read from and write to the database directly via a connection string stored as an environment variable. The Python sentiment service exposes an HTTP endpoint on localhost only — it is never publicly accessible.

### Post-MVP Auth Considerations

If the product is extended with an admin dashboard for manual data overrides, or if monetization introduces any authenticated features, authentication will need to be added at that time. The recommended approach at that point would be a simple email-based magic link (no password) or OAuth (Google/GitHub) — not username/password. This decision is deferred and outside MVP scope.

---

## Testing Strategy

### What to Test

#### Unit Tests

- Score computation logic (Transparency Score, Campaign Finance Score, Factual Consistency Score rules)
- Sentiment aggregation logic (article count threshold enforcement, outlet category grouping)
- robots.txt parser integration (path-level allow/deny checks)
- Zip code validation
- Rate limiter delay calculation
- GovernmentAccessibilityScore criterion evaluation functions (individual criterion checks)

#### Integration Tests

- `/api/locate` — with a mock Cicero API response and a mock PostGIS fallback
- `/api/races` — verifies correct grouping by district level, candidate status, and race status
- `/api/candidates/:slug` — verifies full profile assembly from multiple tables; stale data flag; limited data flag
- `/api/compare` — verifies both candidates are returned and correctly joined
- `/api/accessibility/states` — verifies ranking order and score output
- Database queries — verify that schema relationships are correct and queries return expected results

#### End-to-End Tests

- Happy Path 1 (Everyday Voter): geolocation → dashboard → candidate profile → rating popup
- Happy Path 2 (Engaged Voter): dashboard → profile → compare flow → methodology page link
- Happy Path 3 (Journalist): zip code entry → local race → accessibility detail page
- Exception Path: geolocation denied → zip code fallback → dashboard
- Exception Path: stale data warning visible on profile
- Exception Path: candidate with all-insufficient sentiment scores — no fabricated score displayed
- Shareable URL: `/candidates/:slug` loads correctly with all sections
- Shareable URL: `/compare/:slug1/:slug2` loads correctly

#### Pipeline Tests

- robots.txt compliance: a scraper worker pointed at a test server with a disallowed path must not fetch that path
- Rate limiting: verify that per-source delays are respected between requests
- Retry logic: verify that a 429 response triggers backoff and retry, not immediate re-request
- Dead letter queue: verify that a job exceeding max retries is moved to the dead-letter queue without crashing the worker

#### Manual QA Checklist

- Source links on candidate profile open to valid external URLs in a new tab
- Broken source links show "Source link unavailable" — not a blank field
- Stale data warning is visible without scrolling on desktop and mobile
- "Limited Data Available" banner is visible above the ratings section
- Rating popup opens on tap/click and closes on X or outside tap
- Focus is trapped in open rating popup and returned to trigger on close
- All interactive elements have accessible labels (screen reader test)
- Status badges convey meaning via text, not color alone
- Comparison view works with two candidates from different races
- Comparison URL is stable and loads both profiles correctly

---

## Risks

### Risk 1: News Source ToS Compliance

**Severity:** High
**Description:** Scraping news outlets for sentiment analysis may violate the outlets' Terms of Service. Even with robots.txt compliance and rate limiting, many news sites explicitly prohibit scraping in their ToS.
**Mitigation:** Each news outlet must have its ToS reviewed individually before being added to the pipeline. The `tos_reviewed` and `tos_review_notes` fields in `ScrapingSource` enforce this as a data gate — no outlet is scraped without a ToS review record. For outlets with restrictive ToS, available alternatives include: using publicly available RSS feeds only (not full article text), using archived or cached versions of public pages, or seeking licensing agreements. This is a launch blocker — the pipeline must not go to production with unreviewed sources.
**Open question:** Does scraping news sources for non-commercial civic research constitute fair use? Legal review is recommended before launch.

---

### Risk 2: Political Sentiment Model Performance on Political Text

**Severity:** High
**Description:** Off-the-shelf sentiment models are trained primarily on product reviews, social media, or general news. Political news has domain-specific language, rhetorical framing, and implicit sentiment cues that standard models may misclassify. A model that incorrectly classifies political news sentiment undermines the core value proposition.
**Mitigation:** Evaluate the chosen model on a hand-labeled sample of political news articles (minimum 200 articles, balanced across outlet categories and sentiment classes) before production use. If accuracy is insufficient, investigate fine-tuned models or consider supervised classification on a labeled political news dataset.

---

### Risk 3: Government Data Coverage Gaps

**Severity:** High
**Description:** Many states — and most local governments — do not publish machine-readable candidate data. Candidate profiles for local races may be nearly empty, which could erode user trust if the app presents profiles that are mostly "Limited Data Available" notices with no ratings.
**Mitigation:** Launch with a curated set of states where coverage is known to be adequate. Expand coverage incrementally. Be explicit on the accessibility detail pages about what data is available and why. Manage user expectations through clear UI language.

---

### Risk 4: Cicero API Availability and Cost

**Severity:** Medium
**Description:** Cicero is the primary district resolution service. If Cicero is unavailable, rate-limited, or changes its pricing model, the entire location resolution flow is impacted.
**Mitigation:** The PostGIS/TIGER fallback must be fully functional and tested — not just a stub. Monitor Cicero availability. Cache successful district resolutions by lat/lng coordinate pairs in Redis to reduce repeated API calls for similar locations.
**Risk elevation:** The TIGER fallback may not cover all local district types. Gaps in fallback coverage must be identified before launch.

---

### Risk 5: Scraping Pipeline Reliability at Scale

**Severity:** Medium
**Description:** A daily pipeline scraping thousands of candidates across hundreds of sources is a significant operation. Source websites change structure, add CAPTCHAs, or go down. A brittle scraper breaks silently, producing stale data without warning.
**Mitigation:** Per-source error tracking in the `ScrapeJob` table. Stale data flags surfaced to users. Dead-letter queue for failed jobs. Alerting when a significant percentage of the daily pipeline fails. Scrapers should be modular — a failure on one source must not block other sources.

---

### Risk 6: Infrastructure Cost Growth

**Severity:** Medium
**Description:** Daily scraping, ML inference, Postgres storage, and Redis at scale may become expensive as coverage expands to all 50 states and thousands of candidates.
**Mitigation:** This is a growth risk, not a launch risk. For MVP, keep coverage limited. Implement job deduplication (do not re-scrape a source that has not changed). Consider article fingerprinting to avoid re-processing unchanged content.

---

### Risk 7: Outlet Categorization Perception

**Severity:** High (product, not technical)
**Description:** Any list of news outlets categorized as "conservative", "liberal", or "neutral" will be challenged by some users regardless of the methodology. This is a perception risk that directly threatens the product's neutrality claim.
**Mitigation:** The categorization reference and its academic citations must be prominent on the methodology page. The `OutletCategory.categorization_source` field enforces that every outlet has a cited source for its classification. The methodology page version number enables researchers to cite and scrutinize the specific list used. No outlet classification should be entered without a documented citation.

---

### Risk 8: Source Link Rot

**Severity:** Low-Medium
**Description:** Government and court record URLs change over time. A profile built on valid URLs can develop broken links as sources move or expire.
**Mitigation:** The pipeline checks source link health during each daily refresh. Broken URLs set `source_available = false` and display "Source link unavailable" in the UI. The raw content is preserved in S3 so that the data point itself is not lost even if the original URL breaks.

---

### Risk 9: District Boundary Ambiguity

**Severity:** Medium
**Description:** Users near district boundaries may be placed in the wrong district by both Cicero and the TIGER fallback. A user assigned the wrong district sees the wrong races.
**Mitigation:** The District Confirmation Panel (Screen 4) shows the user their resolved districts and allows them to spot-check. The "Refine location" path and manual district override (resolved in UX design as a should-have feature) allow correction. No technical solution eliminates this risk entirely — the UI mitigation is the primary safeguard.

---

### Risk 10: Legal / Political Advertising Disclaimer Requirements

**Severity:** Medium (open question)
**Description:** Some states have laws governing "political advertising" or "electioneering communications" that may apply to tools presenting information about candidates — even non-partisan, informational tools. Whether this app triggers any disclaimer requirements is unresolved.
**Mitigation:** Legal review before launch. This is an open question, not a resolved decision.

---

## Dependencies

| Dependency | Purpose | Justification |
|---|---|---|
| Next.js | SSR/SSG frontend framework and API routing | Chosen over SvelteKit for ecosystem breadth; avoids a separate API server |
| React | UI component library (bundled with Next.js) | Required by Next.js; component model needed for modals, comparison view, collapsible sections |
| TypeScript | Type safety across frontend and backend | Reduces runtime errors in a data-heavy application; standard for Next.js projects |
| PostgreSQL | Primary relational database | Best fit for relational candidate/race/district data; JSONB support; PostGIS for geometry |
| PostGIS | Postgres extension for geographic queries | Required for TIGER/Line shapefile fallback district lookup |
| Prisma (or Drizzle ORM) | Database schema management and query builder | Prisma for schema migration and type-safe queries; Drizzle is lighter but Prisma is better documented for complex relationships. Choose one before implementation — this is a technical decision gate. |
| Redis | Queue backend for BullMQ and API response cache | BullMQ requires Redis; dual-use with response caching avoids a third caching layer |
| BullMQ | Job queue for the scraping pipeline | Purpose-built for Node.js with rate limiting, retry, priority, and dead-letter queues |
| robots-parser (npm) | Parse and enforce robots.txt rules | Handles `User-agent`, `Disallow`, and `Crawl-delay` directives correctly |
| @mozilla/readability (npm) | Extract article body text from raw HTML | Strips nav/ads/boilerplate; same algorithm used by Firefox Reader View |
| node-fetch or undici (npm) | HTTP fetching in Node.js workers | undici is the modern built-in Node.js HTTP client; preferred over axios for performance in worker contexts |
| Python 3.x | Runtime for the sentiment microservice | NLP ecosystem is significantly stronger in Python |
| transformers (Hugging Face, Python) | Sentiment model inference | Pre-trained model fine-tuned for news/political sentiment; avoids per-call cost |
| torch / onnxruntime (Python) | Model inference backend | torch for development; onnxruntime for lighter production inference if GPU is not available |
| FastAPI (Python) | HTTP interface for the sentiment microservice | Lightweight and fast for an internal microservice; generates OpenAPI docs automatically |
| Cloudflare R2 (or AWS S3) | Raw HTML and article text storage | Audit trail for scraped content; enables re-processing without re-scraping |
| Cicero API | Primary district resolution service | Resolves lat/lng to voting districts across all levels; primary dependency for location flow |
| FEC API | Federal campaign finance data | Public API; avoids scraping FEC for federal candidates |
| Congress.gov API / GovTrack | Federal voting records | Structured data for Congressional votes; GovTrack as alternative |

**Dependencies not recommended:**

| Rejected Dependency | Reason |
|---|---|
| OpenAI API (for sentiment) | Per-call cost at scale; reproducibility concerns; methodology transparency concerns |
| Google NLP API | Same concerns; less control over political text classification |
| Scrapy (Python) | Would require a second Python service for scraping; BullMQ + Node.js is sufficient for MVP and keeps the stack unified |
| Mongoose / DynamoDB | Wrong data model for relational candidate/race/district data |
| Passport.js (auth) | No auth required for MVP |

---

## Open Questions

### Must Be Resolved Before Implementation

1. **ORM selection:** Prisma vs. Drizzle. Prisma is more mature and better documented for complex relational schemas; Drizzle is lighter and closer to raw SQL. This choice affects all database interaction patterns. Recommendation: Prisma for MVP unless the team has strong existing Drizzle familiarity.

2. **News source ToS review process:** Which specific news outlets are included in the initial sentiment pipeline? Each outlet must have a ToS review record before it can be scraped. The initial outlet list and ToS review process must be completed before the sentiment pipeline can go live. This is a launch blocker.

3. **Sentiment model selection and validation:** Which specific Hugging Face model will be used? The model must be evaluated against a labeled political news sample before the sentiment pipeline is finalized. This is a technical gate — the sentiment feature cannot launch with an unevaluated model.

4. **ORM migration tooling:** How are database schema migrations managed? Prisma Migrate is the recommended default if Prisma is selected.

5. **PaaS hosting selection:** Railway, Render, or DigitalOcean App Platform? All three support managed Postgres and Redis. The selection affects CI/CD setup, environment variable management, and deployment configuration. Recommendation: Railway or Render for simplicity and managed Postgres + Redis in one platform.

6. **Factual Consistency Score algorithm:** The business rules define when the score is shown (10+ votes, incumbents always scored) but the specific algorithm for computing the 0–100 score from voting record vs. stated positions has not been defined. This is a product decision that must be made before implementing the score computation worker. Recommendation: bring to Product Analyst for definition before implementation.

7. **PostGIS TIGER/Line data loading:** Which specific TIGER/Line shapefiles cover all district types needed (congressional, state senate, state house, county, city, school district, special district)? Some local district types require separate shapefiles. This must be inventoried before the fallback lookup is implemented.

---

### Open for Later Cycles

8. **Outlet categorization maintenance process:** How is the `OutletCategory` table kept current as outlets change editorial direction, launch, or shut down? A documented review process is needed but is not a launch blocker for MVP.

9. **Social media integration:** Which platforms? What APIs? MVP explicitly excludes social media. This is a future cycle question.

10. **Historical elections repository:** Confirmed as post-MVP scope. Archive schema and migration process needed when this feature is built.

11. **National map (stretch goal):** Not designed or scoped for MVP. GeoJSON tile rendering (e.g., Mapbox, OpenLayers, or D3) will need evaluation when this feature is ready.

12. **Legal review — political advertising disclaimers:** Whether any state law governing "political advertising" or "electioneering communications" applies to this tool. Must be reviewed before a public launch.

13. **Legal review — news scraping fair use:** Whether scraping news outlets for civic research (non-commercial) constitutes fair use. Must be reviewed before the sentiment pipeline goes live at scale.

14. **Monetization (if pursued):** Whether and how to introduce monetization without compromising the neutrality commitment. Explicitly deferred. User accounts would be required for most monetization approaches — this is a significant architectural change if pursued.

---

## Handoff to Implementation

The following must be confirmed before any code is written:

- [ ] ORM selected (Prisma vs. Drizzle)
- [ ] Hosting platform selected (Railway / Render / DigitalOcean)
- [ ] Initial news outlet list produced and ToS reviews begun
- [ ] Sentiment model selected and validation sample prepared
- [ ] Factual Consistency Score algorithm defined by Product Analyst
- [ ] TIGER/Line shapefile inventory completed for all needed district types
- [ ] Cicero API account and key obtained
- [ ] FEC API key obtained
- [ ] S3-compatible storage account set up (Cloudflare R2 or AWS S3)

Implementation will proceed one vertical slice at a time. The recommended first slice is: **Location resolution → District display → Race dashboard** (Epic 1 + Epic 2), as it establishes the core data model and the primary user entry point without requiring the scraping pipeline to be complete.
