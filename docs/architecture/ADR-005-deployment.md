# ADR-005: Deployment Platform

**Date:** 2026-06-27
**Status:** Accepted

## Context

The candidateResearchApp requires a hosting environment that can run all of the following simultaneously:
- A Next.js web server (SSR + API routes)
- One or more BullMQ worker processes (long-running Node.js processes that consume scraping jobs)
- A daily cron-triggered job enqueuer
- A Python FastAPI microservice for sentiment inference (localhost-only)
- A managed PostgreSQL database with the PostGIS extension enabled
- A managed Redis instance (used by BullMQ and as API response cache)
- S3-compatible object storage for raw scraped HTML and article text (Cloudflare R2 or AWS S3 — not required to be on the same platform)

This is a personal project with a single developer. The hosting platform must be simple to operate, cost-effective at MVP traffic levels, and manageable without specialized infrastructure expertise (no Kubernetes, no container orchestration, no cloud-native IAM policies).

The app has no significant traffic expectations at launch — a handful of users and a daily batch pipeline. The hosting decision should be correct for this scale, not for a hypothetical future scale.

## Decision

A PaaS platform — Railway, Render, or DigitalOcean App Platform — is selected for MVP deployment. All three platforms support managed PostgreSQL, managed Redis, multiple process types (web + worker), cron jobs, and Python services. The final selection among the three is deferred as an open question until the hosting account is set up (see Open Questions in technical design).

## Options Considered

### Option A: PaaS (Railway, Render, or DigitalOcean App Platform) — Chosen

Railway, Render, and DigitalOcean App Platform all provide:
- Managed PostgreSQL with PostGIS available (must be confirmed per platform)
- Managed Redis
- Multiple process types from a single repository (web + worker + cron)
- Environment variable management
- Automatic deployments from a Git repository
- Reasonable pricing at low traffic (free tiers or low-cost starter tiers)
- No Kubernetes knowledge required

The critical capability is running multiple process types — the Next.js server and the BullMQ workers must run as separate processes. All three platforms support this via a Procfile or equivalent platform-specific configuration.

PaaS platforms provide vertical scaling (upgrading to a larger instance) as the primary scaling mechanism. Horizontal scaling (multiple web instances behind a load balancer) is available on all three platforms but is not needed for MVP. The daily scraping pipeline is the resource-intensive operation — sizing the worker process type appropriately is more important than web server scaling.

Operational simplicity is the primary selection criterion. A solo developer operating this project should not need to manage container registries, networking policies, or cloud IAM roles to deploy an update.

### Option B: AWS / GCP / Azure (managed Kubernetes or ECS) — Not chosen

AWS, GCP, and Azure offer the full spectrum of managed services required by this application. At sufficient scale they are the right choice. They were not chosen for MVP because:

- Operational complexity is disproportionate to the project's current scale. Running a solo personal project on ECS, EKS, or GKE requires meaningful expertise in IAM, VPC networking, load balancer configuration, and container image management.
- Cost overhead at MVP scale: a minimal AWS deployment (ECS + RDS + ElastiCache + ALB) costs meaningfully more per month than the equivalent on Railway or Render.
- The learning curve diverts time from building the product. For a personal project where the value is in the application, not the infrastructure, this is a poor tradeoff.

The right migration path if the project grows: containerize the application (likely already done as part of PaaS deployment), move the containers to ECS or GKE, and migrate the managed databases to RDS and ElastiCache. This migration is straightforward if the application was already containerized.

### Option C: Vercel (for Next.js) + separate Postgres/Redis — Not chosen

Vercel is purpose-built for Next.js deployment. Zero-config deployment, excellent CDN, and automatic preview environments per branch make it an attractive option for the web layer.

Vercel was not chosen as the primary deployment platform because it cannot run the BullMQ workers or the Python sentiment microservice. Vercel's execution model is serverless functions with timeout limits (default 10 seconds, up to 60 seconds on paid plans). Long-running BullMQ worker processes — which consume a queue continuously, run scraping jobs that may take minutes, and call the Python service — cannot operate within this model.

If Vercel were used for the Next.js frontend, the BullMQ workers and Python service would need to be hosted on a separate platform anyway, splitting the deployment into two environments, two sets of environment variables, and two deployment pipelines. A single PaaS platform that runs all components is simpler to operate.

Vercel remains a valid option if the architecture ever separates the Next.js frontend from the pipeline infrastructure. At that point, hosting the web layer on Vercel and the pipeline on a VPS or PaaS worker service is a reasonable split. For MVP, unified deployment on a single PaaS is preferred.

## Consequences

- The deployment platform must support PostGIS on the managed PostgreSQL instance. This must be verified during platform setup — it is a non-negotiable requirement for the TIGER/Line district resolution fallback.
- The platform must support at minimum three process types: web (Next.js), worker (BullMQ), and cron (daily job enqueuer). A fourth process type for the Python sentiment service may be required depending on how the Python runtime is isolated.
- Environment variables (database URL, Redis URL, Cicero API key, FEC API key, S3 credentials) are managed through the platform's environment variable interface — never committed to source control.
- The Python sentiment microservice must be reachable from the Node.js BullMQ workers via localhost or a private network address. On most PaaS platforms, services in the same project share a private network. This must be confirmed for the chosen platform.
- Object storage (Cloudflare R2 or AWS S3) is provisioned separately from the PaaS platform. R2 is preferred for cost at the volumes expected (no egress fees). The S3-compatible API means no application code changes are needed to switch between R2 and S3.
- Deployments are triggered from the Git repository via the platform's CI/CD integration. No separate CI pipeline is required for MVP.
- Rollback is available through the platform's deployment history. A failed deployment rolls back to the previous successful build via the platform UI.

## Tradeoffs

**Gained:**
- Single platform hosts all application components — one environment to manage, one bill, one set of deployment logs
- Managed PostgreSQL and Redis on the same platform simplifies networking and credential management
- No container orchestration or cloud IAM expertise required
- Automatic deployments from Git with minimal configuration
- Cost-effective at MVP scale

**Given up:**
- Granular scaling control available on cloud-native platforms (per-service auto-scaling, multi-region routing, spot instances)
- Access to the breadth of managed services on AWS/GCP/Azure (advanced monitoring, managed ML inference, edge caching)
- Vercel's superior Next.js-specific deployment experience (preview environments, edge CDN, ISR integration)
- Theoretical cost optimization at high scale that cloud-native platforms enable

## Related ADRs

- ADR-001: Frontend Framework — Next.js API routes and the BullMQ pipeline cannot both run on Vercel; this is why Vercel-only was not chosen.
- ADR-002: Database — PostgreSQL with PostGIS must be available as a managed offering on the chosen platform.
- ADR-003: Scraping Architecture — Multiple process types (web + worker + cron) must be supported by the platform.
- ADR-004: Sentiment Analysis — The Python microservice must be reachable from Node.js workers via a private network address on the platform.
