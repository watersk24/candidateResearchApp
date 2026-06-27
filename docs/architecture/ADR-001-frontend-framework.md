# ADR-001: Frontend Framework

**Date:** 2026-06-27
**Status:** Accepted

## Context

The candidateResearchApp is a read-heavy civic information tool. Its primary purpose is to display pre-computed candidate profiles, ratings, and sentiment scores to anonymous public users. The app has no user accounts or session state, but it does have interactive requirements: modal popups for rating explanations, collapsible sections on candidate profiles, a two-column comparison view with a candidate-selection flow, a geolocation prompt with a zip code fallback, and shareable URLs for candidate profiles and comparison views.

The frontend must support good SEO because candidate profile pages are public-facing content that users may discover through search. Fast initial page load matters for a civic tool where a voter may arrive once before an election. The app is a personal project with a single developer — build complexity should be kept proportionate to scale.

## Decision

Next.js (React, with server-side rendering and static site generation) is the frontend framework for the MVP.

## Options Considered

### Option A: Next.js (React, SSR/SSG) — Chosen

Next.js provides server-side rendering and static site generation natively. Candidate profiles are read-only public content — SSR ensures pages are indexable and load with content on first paint without requiring a client-side API call. React's component model supports the modals, collapsible sections, comparison layout, and geolocation flow cleanly. Next.js API routes let the frontend and backend share a single deployment unit, reducing infrastructure for MVP. File-based routing maps naturally to the URL structure: `/candidates/:slug`, `/compare/:slug1/:slug2`, `/accessibility/:jurisdiction`.

The main downside is that React adds JavaScript weight compared to lighter alternatives, and Next.js has configuration complexity around caching behavior. For a mostly read-only content site this is a real cost, but the interactive requirements justify it.

### Option B: SvelteKit — Not chosen

SvelteKit provides SSR and SSG with a lighter JavaScript footprint than React. Its component model is simpler and bundle sizes are smaller. TypeScript is supported. It is technically competitive with Next.js for this use case and arguably better suited to a mostly-read app.

SvelteKit was not chosen for MVP because the React/Next.js ecosystem has deeper documentation for this exact pattern (SSR + API routes + complex UI components), more available UI component libraries, and broader community resources if external contributors join. If bundle size becomes a measurable concern after launch, migrating to SvelteKit is a reasonable future option.

### Option C: Plain HTML + HTMX — Not chosen

Plain HTML with HTMX avoids JavaScript frameworks entirely, minimizes bundle size, and removes build tooling. For a read-only content site this would be the simplest possible approach.

It was ruled out because the interactive requirements for this app are too significant. The two-column comparison view with dynamic candidate selection, the modal popups for rating explanations (which must manage focus trapping and accessibility), and the geolocation API interaction all require real JavaScript logic. HTMX can handle server-driven partial updates but becomes awkward for component-local state, multi-panel layouts, and browser API calls. Maintaining a complex comparison view in plain HTML + HTMX would produce code harder to reason about than a React component tree.

## Consequences

- The app ships with a React component model — modal logic, comparison view state, and the geolocation flow are managed as React components.
- Next.js API routes serve all backend endpoints (`/api/locate`, `/api/candidates/:slug`, `/api/compare`, `/api/accessibility/*`) from the same deployment unit as the frontend.
- Server-side rendering means candidate profiles are SEO-indexable and load with content on first paint.
- Shareable URLs work natively — `/candidates/:slug` and `/compare/:slug1/:slug2` are rendered server-side and return full HTML to direct visitors and search crawlers.
- The scraping pipeline and BullMQ workers must run as separate processes (not inside Next.js API routes) to avoid starving the frontend server under pipeline load.
- TypeScript is used throughout — Next.js is configured with TypeScript from project initialization.
- Next.js caching behavior (ISR, `cache()`, route segment configs) must be explicitly managed. Default caching assumptions must be verified during implementation.

## Tradeoffs

**Gained:**
- Mature SSR/SSG support with the leading framework for this pattern
- React component model for managing the comparison view, modals, and geolocation flow
- Single deployment unit for frontend and backend at MVP scale
- Large ecosystem of UI component libraries and documented patterns
- File-based routing with clean URL structure

**Given up:**
- Lighter bundle size that SvelteKit or HTMX would have provided
- Simpler build configuration of a no-framework approach
- The theoretical option to deploy the frontend to Vercel without concern about the pipeline (the pipeline cannot run on Vercel anyway, so this tradeoff is largely moot — see ADR-005)

## Related ADRs

- ADR-005: Deployment Platform — Next.js API routes and the BullMQ pipeline cannot both run on Vercel; this drives the PaaS selection.
