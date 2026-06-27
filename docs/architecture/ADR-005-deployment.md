# ADR-005: Deployment Platform

**Date:** 2026-06-27
**Status:** Accepted (updated — Google Cloud selected)

## Context

The candidateResearchApp requires a hosting environment that can run all of the following simultaneously:
- A Next.js web server (SSR + API routes)
- One or more BullMQ worker processes (long-running Node.js processes that consume scraping jobs)
- A daily cron-triggered job enqueuer
- A Python FastAPI microservice for sentiment inference (internal only)
- A managed PostgreSQL database with the PostGIS extension enabled
- A managed Redis instance (used by BullMQ and as API response cache)
- Object storage for raw scraped HTML and article text

The project owner already has an active Google Cloud account, making GCP the natural choice over starting a new account on a PaaS platform. GCP provides all required managed services and scales from personal project to production traffic without a platform migration.

## Decision

**Google Cloud Platform (GCP)** is selected as the deployment platform. The application components map to GCP managed services as follows:

| Application Component | GCP Service |
|---|---|
| Next.js web app | Cloud Run |
| Python sentiment microservice | Cloud Run (separate service) |
| BullMQ workers | Cloud Run Jobs |
| Daily cron trigger | Cloud Scheduler |
| PostgreSQL + PostGIS | Cloud SQL (PostgreSQL) |
| Redis (BullMQ + API cache) | Memorystore (Redis) |
| Object storage (scraped HTML + articles) | Cloud Storage |

## Options Considered

### Option A: Google Cloud Platform — Chosen

**Pros:**
- Project owner already has an account — no new account setup, billing already configured
- Cloud Run supports containerized Node.js and Python services in the same project with private networking between them
- Cloud SQL (PostgreSQL) supports PostGIS — required for the TIGER/Line district resolution fallback
- Memorystore provides managed Redis compatible with BullMQ
- Cloud Scheduler handles the daily cron trigger natively
- Cloud Storage is S3-compatible (via the Google Cloud Storage JSON API and interoperability mode) — no application code changes needed vs. S3
- $300 free credit available for new projects; always-free tiers on several services
- All components under one billing account, one IAM model, one set of monitoring dashboards (Cloud Logging, Cloud Monitoring)
- Cloud Run scales to zero when idle — no cost for the web layer during off-hours
- When the project grows, the same platform handles production scale without a migration

**Cons:**
- IAM and service account configuration adds initial setup complexity vs. Railway/Render
- Cloud Run requires containerizing the application (Dockerfiles for Next.js and Python service)
- More moving parts than a simple PaaS for a first deployment

**Mitigation:** The containerization requirement is not a significant burden — both Next.js and FastAPI have well-documented Dockerfiles. The IAM setup is a one-time cost. The operational complexity is manageable for a developer with an existing GCP account.

### Option B: PaaS (Railway / Render / DigitalOcean) — Not chosen

Railway, Render, and DigitalOcean App Platform are simpler to set up than GCP for a new project. They were not chosen because:
- The project owner already has a GCP account — starting on a new PaaS platform adds a new billing relationship and account without meaningful benefit
- GCP's long-term scalability advantage makes it the correct platform if the project gains traction
- The operational complexity gap between GCP and a PaaS is manageable given existing GCP familiarity

### Option C: Vercel (for Next.js) + separate services — Not chosen

Vercel cannot run BullMQ workers or the Python sentiment service within its serverless function model. Long-running worker processes exceed serverless timeout limits. Splitting the deployment between Vercel and another provider adds operational complexity without benefit. See ADR-001 for details.

## GCP Service Configuration Notes

- **Cloud Run (Next.js):** Deployed as a container. Minimum 1 instance to avoid cold starts on the first user request per day. CPU always allocated during request handling.
- **Cloud Run (Python sentiment service):** Internal-only — not publicly accessible. Invoked from Cloud Run Jobs (BullMQ workers) via Cloud Run's service-to-service authentication.
- **Cloud Run Jobs (BullMQ workers):** Long-running job containers triggered by the daily Cloud Scheduler cron. Multiple concurrent job instances can run in parallel for different scraping sources.
- **Cloud SQL:** PostgreSQL 15+. PostGIS extension must be enabled explicitly after instance creation. Private IP only — not publicly accessible.
- **Memorystore:** Redis 7+. VPC-internal only — accessible from Cloud Run services via VPC connector.
- **Cloud Storage:** One bucket for raw scraped content. Objects stored with keys following: `{source_type}/{jurisdiction_id}/{candidate_id}/{date}/{url_hash}`.
- **Cloud Scheduler:** One job triggering the daily scraping cron at a fixed time (e.g., 2:00 AM local time). Triggers a Cloud Run Job.

## Consequences

- All application components must be containerized (Dockerfiles required for Next.js and Python services).
- Service accounts must be configured for Cloud Run → Cloud SQL, Cloud Run → Memorystore, and Cloud Run → Cloud Storage access. IAM roles follow the principle of least privilege.
- Environment variables (database URL, Redis URL, Cicero API key, FEC API key) are managed via GCP Secret Manager — never committed to source control.
- PostGIS must be manually enabled on the Cloud SQL instance after creation — this is a one-time setup step.
- The Python sentiment service is deployed to Cloud Run as an internal service. It is not publicly accessible and authenticates requests from the worker jobs via GCP's built-in service-to-service authentication.
- Cloud Run's VPC connector is required for Cloud Run services to reach Memorystore (Redis) and Cloud SQL on private IP.
- Deployments are triggered via Cloud Build connected to the Git repository, or via `gcloud run deploy` from a local terminal.

## Tradeoffs

**Gained:**
- No platform migration needed if the project scales — GCP handles production traffic natively
- All components in one GCP project: single billing account, single IAM model, unified logging and monitoring
- Cloud Run scales to zero — no idle cost for the web layer during off-peak hours
- Cloud Storage has no egress fees within GCP (when read by Cloud Run Jobs in the same region) — equivalent cost advantage to Cloudflare R2
- Existing account means no new billing setup

**Given up:**
- Higher initial setup complexity vs. Railway/Render (IAM, VPC connector, container builds)
- No automatic Git-to-deploy without configuring Cloud Build (Railway/Render handle this out of the box)
- More configuration files (Dockerfiles, cloudbuild.yaml, service account JSON) compared to a Procfile-based PaaS

## Related ADRs

- ADR-001: Frontend Framework — Next.js API routes and BullMQ pipeline run in separate Cloud Run services; this is why Vercel-only was not chosen.
- ADR-002: Database — PostgreSQL with PostGIS must be available; Cloud SQL (PostgreSQL) with PostGIS satisfies this requirement.
- ADR-003: Scraping Architecture — Multiple process types (web + worker + cron) must be supported; Cloud Run + Cloud Run Jobs + Cloud Scheduler satisfy this.
- ADR-004: Sentiment Analysis — The Python microservice must be reachable from Node.js workers via private network; Cloud Run service-to-service authentication on GCP's internal network satisfies this.
