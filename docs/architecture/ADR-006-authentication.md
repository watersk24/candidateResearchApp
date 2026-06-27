# ADR-006: Authentication Approach

**Date:** 2026-06-27
**Status:** Accepted

## Context

The candidateResearchApp is a civic information tool that presents pre-computed candidate profiles, ratings, and government accessibility scores to the public. The product's core premise is that any voter should be able to look up their candidates and review the data without any barrier to access. All data displayed by the application is non-sensitive public information about public figures and government entities.

During product and technical design, the question of whether to require user accounts was evaluated. The question bears on complexity, security surface area, privacy obligations, and user experience equally.

The questions that drive this decision are:
- Is there any data or feature that requires knowing who the user is?
- Is there any personalization that would improve the core user journey meaningfully at MVP scale?
- Does adding authentication impose real costs on the users most likely to visit the app (voters checking their candidates once before an election)?

## Decision

The MVP has no authentication. There are no user accounts, no login flow, no session management, and no access-controlled resources. Every page and every API endpoint is publicly accessible without credentials.

## Options Considered

### Option A: No authentication (fully anonymous, no accounts) — Chosen

The MVP user journey — enter a location, view races, review candidate profiles, compare candidates — requires no knowledge of who the user is. All candidate data is pre-computed and publicly available. There is no personalized content, no saved state, no user-specific view, and no data that is appropriate for some users but not others.

Eliminating authentication eliminates an entire category of complexity and risk:
- No user table in the database
- No session middleware in the Next.js server
- No cookie management
- No JWT issuance, validation, or rotation
- No OAuth integration
- No CSRF protection needed on read-only GET endpoints
- No password storage, hashing, or reset flows
- No email verification flow
- No PII collection from users
- No user data privacy obligations beyond standard web server logging

The security model becomes significantly simpler. There is no authentication boundary to protect, no session to hijack, and no user data to expose. The remaining security concerns are input validation on the zip code endpoint, rate limiting on `/api/locate` (which calls the Cicero API and has its own cost and rate limits), and secrets management for API keys — none of which require user accounts.

From a user experience perspective, requiring an account to look up election information adds friction to a flow where the user's motivation may be low and their time is limited. A voter checking candidates the week before an election should not need to create an account.

### Option B: Optional accounts (saved candidates, comparison history) — Not chosen

User accounts could enable personalization features: saving candidate comparisons, receiving email alerts when candidate data is refreshed, or bookmarking a home district to skip the location step on return visits. These are genuine product improvements.

They were not included in MVP scope for two reasons. First, the core value proposition — transparent, neutral candidate research — does not depend on personalization. A voter can look up their candidates, review the data, and make a decision without any saved state. Second, adding optional authentication introduces the full auth infrastructure (user table, sessions, email service, password reset or OAuth integration) even for users who never use it, adding maintenance burden and security surface area proportionate to a fully authenticated app.

If the product matures and personalization becomes a meaningful differentiator, simple authentication options exist: a magic link via email (no passwords) or OAuth via Google or GitHub (no password management). These approaches minimize the risk of the most common authentication vulnerabilities. This decision is explicitly deferred to a future cycle.

### Option C: Required authentication (all features gated behind login) — Not chosen

Requiring login to view candidate information would directly contradict the product's purpose. The goal is to reduce barriers to voter information access. Mandatory authentication is a barrier. It would also create PII collection obligations (email addresses at minimum), introduce legal questions about data retention for a tool serving potentially sensitive political-adjacent queries, and add operational complexity for a personal project.

Required authentication is not appropriate for this product at any stage, with the exception of administrative functions (manual data override, pipeline management) if those are ever added as internal admin features.

## Consequences

- No user table exists in the database schema. No PII is collected from users of the public-facing application.
- No session middleware, cookie configuration, JWT library, or OAuth integration is required in the Next.js application.
- No CSRF protection is required for the public API endpoints (all are read-only GET requests, except `/api/locate` which is a POST but has no state-changing side effects on user data).
- The Cicero API key and other backend secrets are stored as environment variables and never returned to the client. This is the primary secrets management concern in the absence of authentication.
- Rate limiting must be implemented on `/api/locate` to prevent abuse of the Cicero API (which has its own rate limits and per-call costs). This rate limiting is based on IP address, not user identity — a standard approach for anonymous public APIs.
- Input validation on the zip code and lat/lng parameters is required at the API boundary. Without authentication, the API is reachable by any client.
- The internal scraping pipeline and score computation workers are separate processes that do not expose HTTP endpoints to the public. The Python sentiment microservice listens on localhost only. These are not part of the public security model.
- If an admin dashboard for manual data overrides is added in a future cycle, authentication must be added at that time. The recommended approach is magic link (email) or OAuth (Google/GitHub) — not username/password. This is explicitly out of MVP scope.

## Tradeoffs

**Gained:**
- Zero authentication infrastructure — no user table, sessions, cookies, JWTs, OAuth, or email service required
- No PII collection from users of the public application
- No user data privacy obligations (GDPR, CCPA, etc.) from user registration
- No authentication boundary to protect, no session to hijack, no password database to secure
- No friction for users looking up election information on a one-time basis
- Significant reduction in security surface area

**Given up:**
- Personalization features: saved comparisons, district bookmarks, refresh notifications
- Usage analytics tied to returning users (aggregate anonymous analytics remain possible without accounts)
- Any future monetization model that depends on accounts (subscription gating, premium features) would require adding authentication later — this is an acknowledged future complexity if monetization is pursued

## Related ADRs

- ADR-005: Deployment Platform — No session management means no sticky sessions requirement at the load balancer level; any PaaS instance can serve any request.
