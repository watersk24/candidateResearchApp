# Manual QA Checklist

These scenarios require a running Postgres database (with seed data) and/or the Next.js dev server. They cannot be reliably automated in the current test environment.

---

## Integration: scrapeVotingRecord (real DB)

Prerequisites: `candidate_research` DB running, seed data loaded (`npm run db:seed`), `DATABASE_URL` set.

- [ ] Seed a federal House candidate. Run `scrapeVotingRecord(candidateId)` via `npm run db:studio` trigger or `triggerJob.ts`. Verify `voting_records` rows are created with correct `candidate_id`, `bill_or_measure`, `vote`, and `vote_date`.
- [ ] Verify `candidates.last_refreshed_at` is updated after the scrape.
- [ ] Verify `candidates.data_is_stale` is set to `false` after the scrape.
- [ ] Confirm `voting_records.deleteMany` runs first: trigger a second scrape on the same candidate and verify old records are replaced, not duplicated.
- [ ] Seed a federal Senate candidate. Verify `scrapeVotingRecord` sets `has_limited_data = true` and does NOT create voting records (Senate not yet implemented).
- [ ] Seed a state-level candidate. Verify `scrapeVotingRecord` exits early and creates no records.

## Integration: scrapeCampaignFinance (real DB + FEC API)

Prerequisites: `DATABASE_URL` set, `FEC_API_KEY` set.

- [ ] Seed a federal House candidate matching a real FEC record. Run `scrapeCampaignFinance(candidateId)`. Verify `campaign_finance_records` rows are created with `filing_period`, `total_raised`, and `source_url`.
- [ ] Verify `candidates.last_refreshed_at` is updated after the scrape.
- [ ] Seed a candidate with a name not present in FEC. Verify `has_limited_data = true` is set and no finance records are created.
- [ ] Seed a state-level candidate. Verify the scraper exits early without calling FEC.

## Integration: scrapeNewsSentiment (real DB + NewsAPI + sentiment service)

Prerequisites: `DATABASE_URL`, `NEWS_API_KEY`, and `SENTIMENT_API_URL` set. Sentiment service running.

- [ ] Seed a candidate with a well-known name. Run `scrapeNewsSentiment(candidateId)`. Verify `news_articles` rows are created for known outlet domains only.
- [ ] Verify articles from domains not in `news_outlets` are excluded.
- [ ] Stop the sentiment service. Run the scraper. Verify the job completes without throwing — articles are stored with `sentiment = NULL`.
- [ ] Verify `candidates.last_refreshed_at` is updated even when no matching articles are found.

---

## Web App: Candidate Search Page (/search)

- [ ] Navigate to `/search`. Verify the page renders with a search input.
- [ ] Enter a candidate name and submit. Verify results appear (or a "no results" message if none found).
- [ ] Click a result. Verify navigation goes to the candidate profile page.

## Web App: Candidate Profile Page (/candidates/[slug])

- [ ] Navigate to `/candidates/jane-doe-tn-09` (or an equivalent seeded slug). Verify the full profile renders including party, district, and any scraped data.
- [ ] Verify rating popup appears when the rating score is clicked (or hovered per UX spec).
- [ ] Navigate to a non-existent slug (e.g. `/candidates/does-not-exist`). Verify a 404 page or "not found" message is shown.
- [ ] Verify the profile shows a "limited data" indicator when `has_limited_data = true`.

## Web App: Dashboard

- [ ] Load the dashboard after geolocation resolves. Verify races are grouped by level (federal / state / local).
- [ ] Verify each race group lists candidates with their name, party, and profile link.
- [ ] Block geolocation in the browser. Verify the zip-code fallback input appears and functions correctly.
- [ ] Enter an invalid zip code. Verify an appropriate error message is shown.

## Web App: Candidate Comparison View

- [ ] Select two candidates for comparison. Verify the side-by-side view renders with both profiles.
- [ ] Verify the comparison shows consistent data categories for both candidates.

## Web App: Navigation Search

- [ ] Use the Nav search bar to search for a candidate by name. Verify results appear inline or the user is redirected to `/search`.

---

## Edge Cases

- [ ] Candidate with `data_is_stale = true` — verify a "data may be outdated" indicator is shown in the profile.
- [ ] Candidate with zero voting records — verify the profile renders without errors (empty state shown).
- [ ] Candidate with zero finance records — verify the profile renders without errors (empty state shown).
- [ ] District with no active elections — verify the dashboard renders without errors (empty state shown, not a crash).
- [ ] `REDIS_URL` pointing to an unreachable host — verify the worker process logs the error and does not silently hang.

---

## Known Gaps (cannot be automated without further infrastructure)

- **GovTrack API (govtrack.ts)**: The API returns 502s at time of writing. Tests cannot be written for a live endpoint that is down. Will be addressed when a stable endpoint or local stub is available.
- **Cicero district resolution**: Requires a live Cicero API key or a mocked HTTP server. The `/api/districts` route is covered only by manual testing.
- **React component rendering**: Dashboard, CandidateProfile, ComparisonView, Nav, and HomeFlow components require jsdom + react-testing-library. Not set up in the current Vitest config. Adding `@vitest/ui`, `jsdom`, and `@testing-library/react` would enable these.
- **BullMQ queue integration**: The queue worker orchestration (job dispatch, retry behavior, concurrency) requires a real Redis instance. Unit tests cover individual scrapers; end-to-end queue behavior is verified manually.
