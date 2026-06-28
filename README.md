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
- [Cicero API key](https://cicerodata.com) (district resolution — primary)
- [FEC API key](https://api.data.gov/signup) (federal campaign finance data)

## Local Development Setup

**1. Copy and fill environment variables:**
```bash
cp .env.example .env
# Fill in CICERO_API_KEY and FEC_API_KEY
```

**2. Start local Postgres and Redis:**
```bash
docker compose -f docker-compose.dev.yml up -d
```

**3. Install dependencies:**
```bash
npm install
```

**4. Run database migrations and seed outlets:**
```bash
npm run db:migrate    # Creates schema in local Postgres
npm run db:seed       # Seeds the 25 news outlet records
```

**5. Start the web app:**
```bash
npm run dev:web
```

**6. (Optional) Start workers in a second terminal:**
```bash
npm run dev:workers
```

**7. (Optional) Start the Python sentiment service:**
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
| `npm run db:migrate` | Run pending Prisma migrations |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:seed` | Seed news outlet reference data |
| `npm run build:web` | Build Next.js for production |

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
| `GET` | `/api/districts?lat=&lng=` | Resolve voting districts for a coordinate |
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
