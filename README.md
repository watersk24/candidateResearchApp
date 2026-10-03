# Candidate Research App

A neutral, centralized political candidate research web application. Aggregates verifiable public facts, news sentiment by outlet type, and multiple ratings — applying the same methodology equally to every candidate regardless of party.

## Project Structure

```
candidateResearchApp/
├── apps/
│   ├── web/           # Next.js (App Router, TypeScript, Tailwind)
│   └── workers/       # BullMQ job workers for daily scraping pipeline
├── services/
│   └── sentiment/     # Python FastAPI — local Hugging Face sentiment analysis
├── prisma/            # Shared Prisma schema + migrations + seed data
├── docs/              # All discovery, requirements, architecture, and ADR documents
└── docker-compose.dev.yml  # Local Postgres + Redis for development
```

## Prerequisites

- Node.js 24+
- Python 3.12+
- Docker (for local Postgres and Redis)
- [FEC API key](https://api.data.gov/signup) (federal campaign finance data)
- [Congress.gov API key](https://api.congress.gov/sign-up/) and [NewsAPI key](https://newsapi.org/) (enrichment scrapers)

District lookup (U.S. Census Geocoder) and North Carolina race data (NC State Board of Elections) are free and need no keys. See [ADR-008](docs/architecture/ADR-008-open-data-sources.md).

## Local Development Setup

**1. Copy and fill environment variables:**
```bash
cp .env.example .env
# Fill in FEC_API_KEY, CONGRESS_API_KEY, NEWS_API_KEY
```

**2. Start local Postgres and Redis:**
```bash
docker compose -f docker-compose.dev.yml up -d
```

**3. Install dependencies:**
```bash
npm ci
```

> **Lockfile rule:** `package-lock.json` must be generated on Linux (Cloud Shell or WSL). A Windows-generated lockfile omits the Linux build of `@tailwindcss/oxide` and breaks CI, Docker, and Cloud Run builds. On Windows, use `npm ci` (reads the lockfile, never rewrites it) — never `npm install` or editor "quick fixes" that install packages.

**4. Create the schema and seed reference data:**
```bash
npm run db:push       # Syncs the Prisma schema to local Postgres
npm run db:seed       # Seeds the 25 news outlet records (real reference data)
```

The seed script also contains **fictional** demo candidates (Austin, TX) and made-up accessibility scores. They load only when `SEED_DEV_FIXTURES=true` is set and must never be loaded into production.

**5. Import real races and candidates (North Carolina):**
```bash
node --env-file=.env --import tsx/esm apps/workers/src/scripts/ingestRaces.ts ncsbe 2026-11-03
```
Downloads the NCSBE candidate listing and upserts races and candidates. Safe to re-run: existing rows are updated, and candidates no longer listed are marked withdrawn. Contests that need precinct-level data are listed as "unmatched" (see Data Coverage below).

Safety checks: only November general-election dates are accepted (primaries share contest names across parties); rows with the wrong number of fields are skipped, and the run stops if more than 10 are malformed; the run stops if it would withdraw more than 10% of the date's candidates. If such a mass withdrawal is real, re-run with `--force`.

**6. Start the web app:**
```bash
npm run dev:web
```

**7. (Optional) Start workers in a second terminal:**
```bash
npm run dev:workers
```

**8. (Optional) Start the Python sentiment service:**
```bash
cd services/sentiment
python -m venv .venv
.venv/Scripts/activate   # Windows
pip install -r requirements.txt
python main.py
```

## Key Commands

| Command | Description |
|---|---|
| `npm run dev:web` | Start Next.js dev server at localhost:3000 |
| `npm run dev:workers` | Start BullMQ workers with hot reload |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:push` | Sync the Prisma schema to the database (the project has no migrations folder yet) |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:seed` | Seed news outlet reference data (`SEED_DEV_FIXTURES=true` adds fictional demo data) |
| `npm run build:web` | Build Next.js for production |
| `node --env-file=.env --import tsx/esm apps/workers/src/scripts/ingestRaces.ts ncsbe <YYYY-MM-DD>` | Import NC races and candidates for an election date |

## Data Coverage

Races and candidates come from free public sources behind a provider interface keyed by Open Civic Data division IDs ([ADR-008](docs/architecture/ADR-008-open-data-sources.md)). Paid providers can be added later as new adapters.

| Area | Status |
|---|---|
| North Carolina — US Senate and House, NC Senate and House, statewide appellate courts, county-wide offices, at-large town/city races | **Available** (NCSBE candidate listing) |
| North Carolina — school boards, district/superior court judges, district attorneys, district- and ward-based local seats, special districts | Planned (needs precinct data — Slice 2) |
| Federal races outside North Carolina | Planned (FEC — Slice 4) |
| State and local races outside North Carolina | Not planned yet |

Known limitations:
- Incumbency is unknown for imported candidates (the NCSBE listing doesn't report it); the UI does not claim either way.
- Most NC municipal elections are held in odd years, so few city races appear in 2026.
- In production, NC imports run daily at 6:00 AM Eastern (Cloud Scheduler → `ingest-races` Cloud Run Job), for the 2026-11-03 general election only; the date must be changed for later elections. See [race import operations](docs/release/race-import-operations.md).
- Primary elections are not imported yet (party primaries need `party_contest` handling).
- A correction to a candidate's ballot name creates a new candidate record and withdraws the old one, losing its enrichment data.
- `/api/districts` and `/api/geocode` have no rate limiting yet (required by ADR-006; planned at the edge, e.g. Cloud Armor).

## Architecture

See `docs/architecture/` for the full technical design and all Architecture Decision Records (ADRs).

**Stack summary:**
- Frontend + API: Next.js (App Router) on GCP Cloud Run
- Workers: BullMQ + Node.js on GCP Cloud Run Jobs
- Sentiment: Python FastAPI (Hugging Face `cardiffnlp/twitter-roberta-base-sentiment-latest`) on GCP Cloud Run
- Database: PostgreSQL + PostGIS on GCP Cloud SQL
- Queue / Cache: Redis on GCP Memorystore
- Object Storage: GCP Cloud Storage (raw scraped HTML)
- Cron: GCP Cloud Scheduler (daily scraping trigger)

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/geocode?zip=` | Zip code → coordinate (Zippopotam.us) |
| `GET` | `/api/districts?lat=&lng=` | Resolve voting districts for a coordinate (Census Geocoder → OCD-IDs) |
| `GET` | `/api/races?districtIds=` | Get active races for a set of district IDs |
| `GET` | `/api/candidates/[slug]` | Get full candidate profile by slug |

## Documentation

| Document | Purpose |
|---|---|
| `docs/discovery/business-process.md` | Business problem, workflow, rules |
| `docs/requirements/product-requirements.md` | Epics, user stories, acceptance criteria |
| `docs/requirements/ux-design.md` | Screen designs, user journeys |
| `docs/architecture/technical-design.md` | Technical design, data model, ratings algorithms |
| `docs/architecture/ADR-*.md` | Architecture Decision Records |
