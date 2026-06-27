# Business Process Discovery

## Business Problem

Voters lack a neutral, centralized tool for researching political candidates. Most available information comes from biased news outlets, partisan social media, or self-promotional candidate websites. There is no single source that aggregates verifiable public facts alongside media sentiment — applying the same methodology equally to every candidate regardless of party — and links every claim back to its source.

A secondary problem is that voter access to candidate data is unequal across states and localities. Some governments publish rich, machine-readable public records. Others publish little or nothing. Voters have no visibility into these gaps and no easy way to hold their governments accountable for data accessibility. This app surfaces that problem by scoring states and local governments on data accessibility — creating a transparency accountability layer that empowers voters to engage with their governments about improving public data access.

---

## Current State

- Voters research candidates through news outlets that carry editorial bias
- Social media surfaces candidate content through partisan algorithmic feeds
- Candidate websites are self-promotional and one-sided
- Government data (voting records, campaign finance, election filings) exists publicly but is fragmented across many sites and hard for the average voter to find or interpret
- No neutral, aggregated tool exists that presents factual data alongside sentiment analysis with full source transparency
- Voters have no visibility into how accessible or inaccessible their state and local government data is — they cannot easily identify or advocate for improvements

---

## Future State

- A voter opens the web app on any device
- The browser requests geolocation (anonymous — no account required)
- The system identifies the user's voting districts (federal, state, and local) from their location
- A dashboard displays all active races in their area with candidates listed per race
- The user can select any candidate to view a full research profile
- The profile shows verifiable facts (voting record, campaign finance, public statements, legal history, business affiliations) sourced from government and public records
- The profile also shows a sentiment breakdown from news coverage, split by outlet type (left-leaning, right-leaning, neutral)
- Multiple ratings are displayed for each candidate
- Every data point links to its original source for full transparency
- The user can compare two or more candidates side-by-side
- All data is refreshed daily in the background

---

## Actors and Stakeholders

| Actor | Role |
|---|---|
| Voter (anonymous user) | Opens the app, views races, researches candidates, compares candidates |
| Automated data collection system | Scrapes and aggregates data daily from government and public sources |
| Government data sources | State election boards, FEC, legislative voting record systems — authoritative source of truth for factual data |
| News sources | Provide content for sentiment analysis, categorized by outlet type |
| App owner (personal project) | Builds and maintains the system; may monetize if it gains traction |

---

## Trigger

A voter opens the web application and grants browser geolocation permission.

---

## Inputs

| Input | Source |
|---|---|
| User geolocation (lat/long) | Browser geolocation API |
| Voting district boundaries | Government GIS / district mapping data |
| Candidate filing data | State election board websites |
| Voting records | Legislative record systems (Congress.gov, state equivalents) |
| Campaign finance data | FEC, state campaign finance disclosure sites |
| Public statements and speeches | Government records, official transcripts |
| Social media activity | Public profiles |
| News coverage | News sources, categorized by outlet type |
| Criminal and legal history | Public court records |
| Business affiliations | Public business registration records |

---

## Workflow

1. User opens the web app
2. Browser requests geolocation permission
3. User grants permission
4. System maps coordinates to voting districts (federal, state, local)
5. System queries candidate data for all active races in those districts
6. Dashboard renders — all races displayed, all candidates listed per race
7. User selects a candidate
8. Candidate profile page loads with:
   - Verifiable facts (voting record, campaign finance, statements, legal, affiliations)
   - News sentiment breakdown by outlet type
   - Multiple ratings
   - Links to all sources
9. Optionally: user initiates side-by-side candidate comparison
10. In the background (daily): data pipeline refreshes all candidate data

---

## Statuses

### Race Statuses
- **Active** — candidates are filed and the election has not yet occurred
- **Upcoming** — election date is in the future but filing period may still be open
- **Concluded** — election has occurred

### Candidate Statuses
- **Active** — currently filed and running
- **Withdrawn** — filed but dropped out
- **Elected** — won their race

### Data Statuses
- **Current** — refreshed within the last 24 hours
- **Stale** — not refreshed on schedule (show warning)
- **Limited Data Available** — insufficient public data exists; ratings still assigned on available data with this indicator shown

---

## Business Rules

- The same sentiment methodology is applied to every candidate regardless of party
- Factual data is sourced exclusively from government and official public records
- News sentiment is broken down by outlet type (left-leaning / right-leaning / neutral) — not aggregated into a single score that masks the breakdown
- All data points must link to the original source
- No user accounts, no login, no personally identifiable information collected or stored
- Candidates with limited data are still rated on available data; a "Limited Data Available" indicator is shown
- Data is refreshed daily
- Ratings methodology must be documented and publicly visible for transparency

---

## Ratings (Multiple)

### Candidate Ratings

| Rating | What It Measures |
|---|---|
| Transparency Score | How much public information is available about this candidate |
| Sentiment Score | News and public coverage sentiment, broken down by outlet type (left / right / neutral) |
| Factual Consistency Score | How well stated positions align with voting record and documented actions (where data exists) |
| Campaign Finance Score | Donor composition, spending patterns, and finance disclosure completeness |

### Government Data Accessibility Ratings

| Rating | What It Measures |
|---|---|
| State Data Accessibility Score | How well a state publishes candidate and election data in machine-readable, publicly accessible formats |
| Local Government Data Accessibility Score | How well local governments (county, city, district) publish candidate and election data |

**Scoring criteria for Data Accessibility Scores:**
- Is candidate filing data publicly available?
- Is it machine-readable (structured data vs. PDF only)?
- Is it accessible without authentication or fees?
- Is it updated in a timely manner?
- Are voting records available and structured?
- Is campaign finance data published with sufficient detail?
- Does the jurisdiction's robots.txt restrict programmatic access to public election data? (Restriction counts against the score — voters have a right to access data on candidates they are asked to vote on.)
- If no public data sources exist at all for candidates in a race, the jurisdiction scores near 0 — complete absence of voter access is the most severe accessibility failure.

These scores are displayed alongside candidate data so voters can see the quality of the data they are viewing — and identify gaps they can raise with their state or local government.

---

## Exceptions and Edge Cases

- **User denies geolocation** — allow manual zip code or district entry as fallback
- **Candidate with no public data** — show "Limited Data Available" indicator; still display what exists
- **New or first-time candidate** — no voting record available; Factual Consistency Score is based only on public statements
- **State with no machine-readable election data** — flag as a known gap; show what is available
- **Candidate withdraws after data is collected** — update status to Withdrawn; retain profile data
- **Multiple candidates with the same name** — display district and party to disambiguate
- **Local races with no news coverage** — Sentiment Score shows "Insufficient coverage data"

---

## Notifications

None at this stage. The app is fully on-demand and anonymous. No push notifications, email alerts, or account-based features.

---

## Reporting Needs

None at this stage for personalized reporting (no user accounts). However, the app itself produces two public-facing aggregate views:

- **State Data Accessibility Rankings** — a ranked list of all 50 states by their data accessibility score, visible to any user
- **Local Government Data Accessibility Rankings** — a ranked list of local governments within the user's area by their data accessibility score

These views serve a civic engagement purpose: voters can see where their state or locality ranks and have a factual basis for contacting their representatives about improving public data access.

---

## Assumptions

- The application is US-only for the initial version
- The app is a web application (browser-based, responsive for mobile)
- Daily data refresh is sufficient for most use cases during election season
- News outlet categorization (left / right / neutral) is defined using a pre-established, documented reference list
- Government data sources are publicly accessible without authentication
- The ratings methodology will be documented and visible to users as part of the transparency commitment
- Geolocation → district mapping is achievable using publicly available GIS or civic data APIs

---

## Risks

| Risk | Severity |
|---|---|
| Government data sources vary significantly by state — some have no APIs or machine-readable formats | High |
| Outlet type categorization (left/right/neutral) is itself a judgment call that could be perceived as biased | High |
| Sentiment analysis algorithms carry inherent statistical bias regardless of equal application | Medium |
| Local candidate data is often extremely sparse — ratings may be low-confidence | Medium |
| Scraping some government or news sites may conflict with their Terms of Service | High |
| Geolocation accuracy may not resolve to the correct local district (especially near district boundaries) | Medium |
| Infrastructure costs (data storage, daily refresh pipelines, sentiment analysis APIs) could grow significantly with usage | Medium |
| Monetization approach (if pursued) must not compromise the neutrality commitment | Medium |
