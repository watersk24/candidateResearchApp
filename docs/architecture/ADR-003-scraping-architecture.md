# ADR-003: Job Queue and Scraping Architecture

**Date:** 2026-06-27
**Status:** Accepted

## Context

The candidateResearchApp's core data comes from a daily scraping pipeline that collects candidate profile data, voting records, campaign finance records, news articles, and court records from government websites, FEC/state finance portals, and news outlets. This pipeline is the heaviest operational component of the application.

The scraping pipeline must:
- Run on a daily schedule (triggered by cron)
- Process thousands of candidates across hundreds of sources
- Enforce per-source rate limiting (configurable delay between requests)
- Respect robots.txt rules at both onboarding time and at the start of each daily cycle
- Retry failed jobs with exponential backoff
- Route jobs that exceed maximum retries to a dead-letter queue for manual inspection
- Isolate source failures — a broken scraper for one source must not block other sources
- Write structured records to PostgreSQL and raw HTML/text to S3-compatible object storage
- Call the Python sentiment microservice after article collection completes
- Produce a daily health report summarizing completed, failed, and skipped jobs

The application is a personal project with a single developer. The pipeline must be operable without specialized infrastructure expertise.

## Decision

BullMQ (backed by Redis) is the job queue. Node.js worker processes consume jobs from BullMQ queues and execute all scraping logic. Workers run as separate processes from the Next.js frontend/API server.

## Options Considered

### Option A: BullMQ + Node.js workers — Chosen

BullMQ is a Node.js job queue built on Redis. It provides rate limiting, priority queuing, retry with configurable backoff, dead-letter (failed) queues, and job status visibility out of the box. Redis is already in the stack as the caching layer — BullMQ uses the same Redis instance as a second purpose, avoiding a third infrastructure component.

Node.js workers run as separate processes from the Next.js server. This isolation means a heavy scraping run does not starve the web server. Workers are started and managed by the deployment environment. Horizontal scaling (running additional worker processes) is possible without code changes — BullMQ workers compete for jobs from the shared Redis queue.

The entire pipeline — scheduler, workers, score computation, sentiment call — is written in TypeScript alongside the rest of the application. There is no second language to maintain, no inter-process serialization format to manage between the scraper and the database writer, and no separate deployment for the scraping runtime.

Node.js is single-threaded per process. CPU-intensive HTML parsing at very high volume could become a bottleneck. At MVP scale (hundreds to low-thousands of candidates, not millions), this is not a limiting factor. Per-source queue instances ensure that a slow source (e.g., one with a 5-second crawl delay) does not hold up faster sources in a shared queue.

BullBoard (or a lightweight custom admin page) provides queue depth, job status, and failure log visibility. This is an internal tool only — not exposed to public users.

### Option B: Python Scrapy + Celery — Not chosen

Scrapy is a purpose-built Python scraping framework with a mature middleware system for rate limiting, robots.txt compliance, retry, and item pipelines. Celery is a mature Python distributed task queue. Both have strong community support in the web scraping community.

The primary reason Scrapy/Celery was not chosen for MVP is that it introduces a second runtime (Python) for the scraping component when the sentiment analysis service already requires a Python process. While consolidating scraping and NLP in Python is conceptually tidy, the two concerns have very different operational characteristics: the sentiment service is a stateless inference service, while the scraping pipeline is a stateful scheduled job system. Coupling them into a single Python deployment adds complexity without benefit at MVP scale.

Additionally, Scrapy's output pipeline would need to write to PostgreSQL from Python, introducing a second database client (psycopg2/asyncpg) that must be kept in sync with the TypeScript schema. BullMQ + Node.js allows the scraping workers to use the same ORM and schema definitions as the rest of the application.

Migrating to Scrapy/Celery is a reasonable future option if the pipeline's volume or complexity grows beyond what BullMQ + Node.js workers can handle cleanly.

### Option C: Third-party scraping services (Apify, Brightdata, ScrapingBee) — Not chosen

Managed scraping platforms handle IP rotation, CAPTCHA solving, browser rendering, and proxy management. For sources that actively block scrapers, these services solve a real technical problem.

They were not chosen as the primary architecture for three reasons. First, cost at scale: the pipeline scrapes hundreds of sources daily across thousands of candidates. Per-request pricing on managed platforms grows quickly at this volume. Second, transparency: a civic research tool that scrapes government and news sources should be able to document exactly what it collects and how — using a third-party black-box proxy service makes this harder to audit and explain on the methodology page. Third, a dependency on a commercial scraping service for a civic data pipeline is a business continuity risk — if the service changes pricing, terms, or availability, the entire pipeline is affected.

Managed scraping services may be useful for specific problem sources (e.g., a government site that requires JavaScript rendering or has aggressive bot detection) on a per-source basis. They are not the right primary architecture for the full pipeline.

## Consequences

- Redis must be provisioned as part of the deployment. On Railway, Render, and DigitalOcean, Redis is available as a managed add-on on the same platform. Redis serves as both the BullMQ queue backend and the API response cache.
- BullMQ worker processes are deployed as separate long-running processes alongside the Next.js server. The deployment platform must support running multiple process types from the same repository (e.g., a Procfile or platform-specific process configuration).
- The daily cron trigger that enqueues jobs must be implemented as a scheduled process. Most PaaS platforms support cron-triggered jobs natively. If not, BullMQ's built-in `Queue.add()` with a `repeat` option can handle scheduling internally.
- Per-source rate limiting is implemented at the BullMQ queue level using per-source queue instances. A source with a 2-second crawl delay runs in its own named queue with a rate limiter — it does not block workers processing other sources.
- The Python sentiment microservice is called via HTTP from Node.js workers after article collection completes. The Python service runs on localhost and is not exposed externally.
- The `robots-parser` npm package parses and enforces robots.txt rules. Each source's robots.txt is fetched once per daily cycle (not per request) and cached for the duration of that cycle.
- Raw scraped HTML and article text are written to S3-compatible object storage (Cloudflare R2 or AWS S3) under structured keys for audit and re-processing.
- BullBoard or a lightweight admin page must be deployed as an internal tool for queue monitoring. Access to this tool must be restricted to the server environment — it must not be publicly accessible.

## Tradeoffs

**Gained:**
- Single language (TypeScript/Node.js) for the entire pipeline, sharing ORM, schema types, and utilities with the frontend and API
- BullMQ provides rate limiting, retry, dead-letter queue, and job visibility without requiring a managed queue service
- Redis dual-use (queue + cache) avoids a third infrastructure component
- Horizontal scaling by adding worker processes is possible without code changes
- Full pipeline visibility and auditability — no black-box external service

**Given up:**
- Scrapy's purpose-built scraping middleware ecosystem (middleware for robots.txt, retry, and rate limiting must be implemented in BullMQ workers rather than inherited from a framework)
- Python scraping ecosystem tools (browser rendering via Playwright is available in Node.js, so this gap is not significant)
- Managed IP rotation and CAPTCHA handling (may need to be added per-source for difficult sources)

## Related ADRs

- ADR-002: Database — BullMQ workers write directly to PostgreSQL using the same ORM as the rest of the application.
- ADR-004: Sentiment Analysis — The sentiment Python microservice is called from BullMQ workers via HTTP after article collection completes.
- ADR-005: Deployment Platform — The PaaS selection must support running multiple process types (web server + worker processes + cron trigger).
