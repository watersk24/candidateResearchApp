# Product Requirements

**Status:** Draft
**Date:** 2026-06-27
**Based on:** Business Process Discovery and Open Questions documents

---

## Product Goal

Build a neutral, anonymous, source-transparent political candidate research web application that empowers voters to evaluate candidates at every level of government — federal, state, and local — using only verifiable public records and consistently applied methodology. The same analytical framework is applied equally to every candidate regardless of party affiliation.

A secondary goal is to surface government data accessibility gaps as a civic accountability tool, giving voters a factual basis to engage with their representatives about improving public data access.

---

## Users

### Persona 1: The Everyday Voter

**Description:** A registered voter who votes in major elections but does not closely follow politics between cycles. They hear candidate names on social media or from friends but have no reliable way to quickly check facts. They distrust partisan news sources but have limited time to cross-reference government records themselves.

**Behavior:** Opens the app close to an election. Wants quick, digestible, neutral information. Is unlikely to read deep methodology documentation. Uses their phone.

**Needs:**
- Fast, friction-free access to candidates in their area
- Clear, simple scores they can understand at a glance
- Confidence that what they are seeing is factual and not biased
- No account creation or login required

---

### Persona 2: The Engaged Voter

**Description:** A politically active voter who follows local and state government closely, attends town halls, and may advocate for specific policy positions. They consume news from multiple sources and are already aware of media bias. They want deeper access to the factual record on a candidate.

**Behavior:** Uses the app multiple times leading up to an election. Drills into source links to verify data. Interested in the ratings methodology. Likely to compare candidates side by side. Interested in government data accessibility scores as a transparency issue.

**Needs:**
- Full candidate profiles with source links on every data point
- Side-by-side candidate comparison
- Sentiment breakdown by outlet type (not just an aggregate score)
- Government data accessibility rankings and context
- Confidence in methodology transparency

---

### Persona 3: The Journalist or Researcher

**Description:** A reporter, academic, or civic organization researcher who needs a fast starting point for candidate research and wants structured, sourced data. They will verify claims independently but benefit from having a neutral starting point.

**Behavior:** Searches for specific candidates or races. Exports or links to candidate profiles. Reads the methodology documentation carefully. Likely to revisit the app repeatedly across multiple races and election cycles.

**Needs:**
- Reliable, sourced candidate profiles for multiple races and candidates
- Sentiment analysis broken down in a consistent, documented methodology
- Data freshness indicators (last refresh timestamp)
- Ability to identify when data is limited or unavailable
- Access to government data accessibility rankings for civic reporting

---

## User Value

| Persona | Primary Value |
|---|---|
| Everyday Voter | Saves time; provides neutral starting point that replaces partisan sources |
| Engaged Voter | Depth, source transparency, and comparability of factual records |
| Journalist / Researcher | Structured, sourced starting point for candidate research with consistent methodology |

---

## MVP Scope

The following capabilities are in scope for the first release:

1. Geolocation-based district identification (with zip code fallback)
2. Race and candidate dashboard for the user's districts
3. Candidate profile page with available factual data and source links
4. Candidate ratings: Transparency Score, Sentiment Score, Factual Consistency Score, Campaign Finance Score
5. News sentiment breakdown by outlet type (left / right / neutral)
6. Side-by-side candidate comparison (two candidates)
7. Data freshness indicator on all profiles
8. "Limited Data Available" indicator for candidates with sparse records
9. State Data Accessibility Rankings (public-facing ranked list)
10. Local Government Data Accessibility Rankings (within the user's area)
11. Publicly visible ratings methodology documentation
12. Manual zip code / district entry as a fallback when geolocation is denied

---

## Epics

---

### Epic 1: Location and District Identification

**Goal:** Identify every race relevant to the user based on their physical location, without requiring an account or storing any personal data.

#### Features

- Browser geolocation prompt on app load
- Coordinate-to-district mapping across federal, state, and local levels
- Manual zip code or district entry as geolocation fallback
- Clear indication when geolocation permission is denied and what to do next

#### User Stories

**US-1.1**
As an everyday voter, I want the app to automatically detect my location when I open it, so that I can immediately see all the races relevant to me without having to search manually.

**US-1.2**
As an everyday voter, I want to enter my zip code manually if I decline location access, so that I can still see races in my area without sharing my precise location.

**US-1.3**
As an engaged voter, I want to see which districts I have been placed in (e.g., congressional district 5, state senate district 12), so that I can confirm the app has identified my correct districts before I rely on the results.

#### Acceptance Criteria

**US-1.1**
- The browser geolocation permission prompt is shown when the user first loads the app
- If permission is granted, the system resolves the coordinates to all relevant voting districts within a reasonable time
- If geolocation fails or times out, the user is shown a prompt to enter their zip code instead
- No location data is stored or transmitted beyond what is required to resolve the user's districts

**US-1.2**
- A zip code entry field is displayed when geolocation is denied or unavailable
- If a valid US zip code is entered, the system resolves it to the appropriate districts
- If an invalid zip code is entered, the user receives a clear error message
- The fallback experience presents the same race dashboard as the geolocation path

**US-1.3**
- After district resolution, the user can see a list of their identified districts (e.g., US House District 7, State Senate District 22, County Commissioner District 3)
- The district list is displayed before or alongside the race dashboard
- If a district cannot be confidently resolved, this is indicated clearly

---

### Epic 2: Race and Candidate Dashboard

**Goal:** Present all active races in the user's area in a clear, organized format so the user can see the full scope of elections they are eligible to vote in.

#### Features

- Dashboard listing all active races grouped by government level (federal, state, local)
- Candidate names listed under each race
- Race status indicators (Active, Upcoming, Concluded)
- Candidate status indicators (Active, Withdrawn, Elected)
- Navigation from any candidate name to their full profile page

#### User Stories

**US-2.1**
As an everyday voter, I want to see all races in my area grouped by government level, so that I can quickly understand what offices are on my ballot.

**US-2.2**
As an everyday voter, I want to see which candidates are running in each race, so that I can decide which candidates to research.

**US-2.3**
As an engaged voter, I want to see the status of each race and each candidate (Active, Upcoming, Concluded, Withdrawn), so that I know which races are still open and which candidates are still active.

**US-2.4**
As an everyday voter, I want to click on a candidate's name and go directly to their profile, so that I can start researching them without additional navigation steps.

#### Acceptance Criteria

**US-2.1**
- Races are grouped into at least three categories: Federal, State, Local
- Each group displays its races with the office name and election date if available
- An empty state is displayed if no races are found for a given level

**US-2.2**
- Each race displays the names of all filed candidates
- Candidates marked as Withdrawn are displayed but clearly labeled as Withdrawn
- The dashboard does not omit candidates based on party affiliation or any other filter

**US-2.3**
- Each race displays a status badge (Active, Upcoming, Concluded)
- Each candidate displays a status badge (Active, Withdrawn, Elected)
- Status definitions are accessible to the user (e.g., via a tooltip or help text)

**US-2.4**
- Every candidate name on the dashboard is a link to that candidate's profile page
- The profile page loads without requiring any login or account creation
- If a candidate profile has no data, the profile still loads and displays a "Limited Data Available" indicator

---

### Epic 3: Candidate Profile

**Goal:** Provide each voter with a comprehensive, source-linked profile for any candidate in their area, built from verifiable public records.

#### Features

- Voting record section (where available)
- Campaign finance section (donor composition, spending patterns, disclosure completeness)
- Public statements section (sourced from official transcripts and government records)
- Legal history section (sourced from public court records)
- Business affiliations section (sourced from public business registration records)
- Source link on every individual data point
- Data freshness timestamp
- "Limited Data Available" indicator when public records are sparse
- Candidate status display (Active, Withdrawn, Elected)

#### User Stories

**US-3.1**
As an engaged voter, I want to see a candidate's voting record sourced from government records, so that I can evaluate how they have actually voted versus what they claim to support.

**US-3.2**
As an engaged voter, I want to see a candidate's campaign finance information, so that I can understand who is funding their campaign and how money is being spent.

**US-3.3**
As a journalist or researcher, I want every data point on a candidate's profile to link to its original source, so that I can independently verify the information before publishing or citing it.

**US-3.4**
As an everyday voter, I want to know when a candidate's profile was last refreshed, so that I know whether the data I am looking at is current.

**US-3.5**
As an everyday voter, I want to see a clear notice when a candidate has limited publicly available data, so that I understand the profile is incomplete and not mistakenly rely on absence of data as evidence.

**US-3.6**
As an engaged voter, I want to see a candidate's public statements and positions sourced from official records, so that I can assess their stated positions without relying on partisan framing.

**US-3.7**
As an engaged voter, I want to see a candidate's legal history from public court records, so that I can assess any relevant legal matters as part of my evaluation.

**US-3.8**
As an engaged voter, I want to see a candidate's business affiliations from public records, so that I can identify potential conflicts of interest.

#### Acceptance Criteria

**US-3.1**
- Voting record entries display the bill or measure name, the candidate's vote, the date, and a direct link to the source record
- If no voting record exists (e.g., first-time candidate), the section displays a clear message explaining why and does not show empty or blank data
- Voting record data is drawn exclusively from government records, not news summaries

**US-3.2**
- Campaign finance section shows donor composition (individual vs. PAC vs. party, by percentage or amount where available)
- Spending patterns are shown where data is available
- Disclosure completeness is indicated (e.g., how complete the candidate's finance filings are)
- Each data point links to the originating FEC or state campaign finance disclosure source

**US-3.3**
- Every individual fact, figure, or claim on the profile includes a visible source link
- Source links open to the original government or public record
- Links that are broken or unavailable are flagged, not silently dropped

**US-3.4**
- A "Last refreshed" timestamp is displayed on the profile
- If the data is stale (not refreshed within 24 hours), a visible warning is displayed
- The timestamp reflects the most recent successful data refresh, not the current time

**US-3.5**
- A "Limited Data Available" badge or notice is displayed when public data for this candidate is insufficient to fully populate the profile
- The notice explains what data is unavailable and why (e.g., "This state does not publish machine-readable voting records")
- Ratings are still displayed but reflect the limited data with appropriate context

**US-3.6**
- Public statements are sourced from official government transcripts, press releases, or public record sources
- Each statement entry includes the date, source type, and a link to the original record
- Statements from candidate websites or campaign materials are not included as factual sources

**US-3.7**
- Legal history entries are sourced from public court records
- Each entry displays the case type, date, jurisdiction, outcome (if concluded), and a source link
- If no legal history exists in public records, the section states "No legal history found in public records" rather than being hidden

**US-3.8**
- Business affiliations are sourced from public business registration records
- Each entry shows the entity name, role, state of registration, and a source link
- If no affiliations are found, the section states "No business affiliations found in public records" rather than being hidden

---

### Epic 4: Candidate Ratings

**Goal:** Give every voter clear, multi-dimensional ratings for each candidate that are derived from the same documented methodology regardless of party, with enough context to understand what each rating means.

#### Features

- Transparency Score per candidate
- Sentiment Score per candidate (broken down by outlet type)
- Factual Consistency Score per candidate
- Campaign Finance Score per candidate
- Publicly visible ratings methodology documentation
- Ratings displayed with context (not just a number)
- "Limited Data" qualifier shown on ratings where data is sparse

#### User Stories

**US-4.1**
As an everyday voter, I want to see a Transparency Score for each candidate, so that I can quickly understand how much publicly available information exists about them.

**US-4.2**
As an everyday voter, I want to see a Sentiment Score that shows how news outlets cover the candidate, broken down by left-leaning, right-leaning, and neutral outlets, so that I can see whether coverage varies by outlet type rather than relying on a single aggregate number.

**US-4.3**
As an engaged voter, I want to see a Factual Consistency Score that reflects how well a candidate's stated positions align with their documented actions, so that I can assess whether they follow through on their positions.

**US-4.4**
As an engaged voter, I want to see a Campaign Finance Score that reflects donor composition, spending patterns, and disclosure completeness, so that I can evaluate a candidate's financial transparency.

**US-4.5**
As a journalist or researcher, I want to read the full ratings methodology in plain language, so that I can assess the credibility of the ratings before citing them.

**US-4.6**
As an everyday voter, I want to see a clear qualifier when a rating is based on limited data, so that I do not over-interpret a score that reflects incomplete public records.

#### Acceptance Criteria

**US-4.1**
- Transparency Score is displayed on every candidate profile
- Score is composed of four components: profile data completeness (0–40 pts), campaign finance filing compliance (0–30 pts), public record depth (0–20 pts), and data currency (0–10 pts), totaling 0–100
- A clickable icon adjacent to the score opens a popup explaining how the score was calculated for this candidate
- The popup links to the full methodology page
- If data is limited, the score includes a "Limited Data" qualifier
- Component weights confirmed: data completeness (0–40), finance filing compliance (0–30), public record depth (0–20), data currency (0–10)

**US-4.2**
- Sentiment Score is displayed as a breakdown across three outlet categories: conservative (right-leaning), liberal (left-leaning), and neutral
- Categories are defined using textbook political science definitions, documented on the methodology page
- The breakdown is not collapsed into a single aggregate score that hides the distribution
- The number of articles analyzed per outlet category is displayed or accessible
- If fewer than 50 articles exist for a given outlet category, that category displays "Insufficient coverage data" rather than a score
- Analysis covers back to the last election cycle for the office in question
- The same outlet categorization list and methodology is applied to all candidates without exception

**US-4.3**
- Factual Consistency Score behavior depends on voting record depth:
  - Fewer than 10 recorded votes → score is not assigned; profile displays "New Candidate / Minimal Voting Record" instead
  - 10 or more recorded votes → score is calculated based on consistency between stated positions and voting record
  - Incumbents are always scored regardless of vote count
- A clickable icon opens a popup explaining the scoring and what threshold applies to this candidate
- The popup links to the full methodology page

**US-4.4**
- Campaign Finance Score is displayed on every candidate profile
- Score measures two dimensions: (1) availability — whether all legally mandated filings have been submitted, and (2) accuracy — whether reported donations match reported expenditures
- Each dimension contributing to the score is visible or accessible from the score popup
- A clickable icon opens a popup explaining the score for this candidate
- The feature is marked as evolving; the methodology page notes it may be refined as real data is evaluated

**US-4.5**
- A methodology documentation page is publicly accessible without login
- The page explains in plain language how each of the four ratings is calculated
- The page documents what data sources are used for each rating
- The page documents the outlet categorization reference and textbook definitions used for Sentiment Scores
- The page documents the Transparency Score component weights and what each measures
- The page documents the Factual Consistency Score threshold (10 votes) and incumbent rule
- The page documents the Campaign Finance Score dimensions and notes it is an evolving feature
- A clickable icon on each displayed rating opens a popup summary; the popup links to the full methodology page

**US-4.6**
- Any rating based on limited data displays a visible "Limited Data" qualifier adjacent to the score
- The qualifier includes brief context explaining what data is missing

---

### Epic 5: News Sentiment Analysis

**Goal:** Provide every voter with a factual, consistently applied view of how news media covers each candidate, segmented by outlet type to make bias distribution visible rather than hidden.

#### Features

- News sentiment analysis per candidate
- Outlet categorization by type (left-leaning, right-leaning, neutral)
- Sentiment breakdown displayed per outlet type (not aggregated)
- Article count per outlet type displayed or accessible
- Minimum article threshold before displaying sentiment
- "Insufficient coverage data" state for candidates with low coverage
- Consistent methodology applied across all candidates

#### User Stories

**US-5.1**
As an engaged voter, I want to see how news sentiment toward a candidate varies across left-leaning, right-leaning, and neutral outlets, so that I can understand whether coverage of this candidate is polarized or consistent.

**US-5.2**
As a journalist or researcher, I want to see how many articles were analyzed per outlet type, so that I can assess the statistical weight of the sentiment scores before citing them.

**US-5.3**
As an everyday voter, I want to know when a candidate has too little news coverage to produce a reliable sentiment score, so that I am not misled by a score based on one or two articles.

#### Acceptance Criteria

**US-5.1**
- Sentiment analysis is segmented into three categories: left-leaning, right-leaning, neutral
- Each category shows a sentiment result (positive, neutral, negative, or equivalent)
- The same outlet categorization reference is applied to all candidates without exception
- The categorization reference used is documented in the methodology page

**US-5.2**
- The number of articles analyzed per outlet category is displayed alongside the sentiment result
- The display makes clear that this is the count used for the specific candidate and time range shown

**US-5.3**
- If the article count for a given outlet type falls below the minimum threshold, the result for that category displays "Insufficient coverage data"
- The threshold value is documented on the methodology page
- A candidate with no coverage in any outlet type shows "Insufficient coverage data" across all categories, not a neutral score

---

### Epic 6: Candidate Comparison

**Goal:** Allow a voter to evaluate two candidates side by side using the same data fields and ratings so that differences are visible without narrative framing.

#### Features

- Side-by-side comparison view for two candidates
- All ratings displayed in parallel columns
- Key factual data points displayed in parallel columns
- Sentiment breakdown displayed in parallel for both candidates

#### User Stories

**US-6.1**
As an everyday voter, I want to compare two candidates side by side, so that I can see the differences in their records and ratings without switching between pages.

**US-6.2**
As an engaged voter, I want the comparison view to include all four ratings and the sentiment breakdown for both candidates, so that I can evaluate them on the same dimensions simultaneously.

#### Acceptance Criteria

**US-6.1**
- The user can initiate a comparison from the candidate dashboard or from an individual candidate's profile page
- The comparison view displays both candidates in parallel columns
- The comparison is available for any two candidates regardless of whether they are in the same race
- No account or login is required to use the comparison feature

**US-6.2**
- The comparison view includes all four ratings (Transparency Score, Sentiment Score, Factual Consistency Score, Campaign Finance Score) for both candidates
- The Sentiment Score in the comparison view shows the outlet-type breakdown for both candidates
- Key factual data categories (voting record, campaign finance, legal history, business affiliations) are represented in the comparison
- "Limited Data" qualifiers are preserved and visible in the comparison view

---

### Epic 7: Government Data Accessibility Rankings

**Goal:** Give voters a factual, publicly visible view of how well their state and local governments publish candidate and election data, creating a civic accountability tool they can act on.

#### Features

- State Data Accessibility Rankings (ranked list of all 50 states)
- Local Government Data Accessibility Rankings (within the user's area)
- Scoring criteria displayed for each government entity
- Explanation of what each scoring criterion means
- Link from candidate profile to the relevant government's accessibility score

#### User Stories

**US-7.1**
As an engaged voter, I want to see how my state ranks in data accessibility compared to other states, so that I know whether my state is publishing election data in a way that serves voters.

**US-7.2**
As an engaged voter, I want to see how my local government ranks in data accessibility, so that I can identify gaps in local election data and have a factual basis for contacting my local representatives.

**US-7.3**
As a journalist or researcher, I want to access the ranked list of all 50 states by data accessibility score, so that I can report on national trends in government data transparency.

**US-7.4**
As an everyday voter, I want to understand what the data accessibility score measures, so that I can interpret the ranking without needing a technical background.

**US-7.5**
As an engaged voter, I want the candidate profile to show me the data accessibility score for the government source used to build that profile, so that I can see at a glance whether the profile is likely complete or constrained by data gaps.

#### Acceptance Criteria

**US-7.1**
- A State Data Accessibility Rankings page displays all 50 states with their scores
- States are ranked from highest to lowest accessibility
- The scoring criteria are disclosed on the page
- The user's detected state is visually highlighted in the rankings

**US-7.2**
- Local government accessibility scores are shown for governments within the user's detected area
- Local governments covered include counties, cities, school districts, and special districts
- Local governments are ranked or grouped in a way that makes gaps visible
- The scoring criteria and benchmarking method are consistent with those used for state scores

**US-7.3**
- The full 50-state rankings list is publicly accessible without login, search, or filtering required
- The rankings are exportable or linkable (direct URL to the rankings page)

**US-7.4**
- A plain-language explanation of the scoring methodology is displayed on the rankings page
- The methodology explains the benchmarking approach: the highest-access states anchor 100%, the lowest anchor ~0%, all others are scored by number of accessible public systems relative to those anchors
- Scoring criteria include: whether data is publicly available, machine-readable, free, timely, and whether robots.txt is used to restrict programmatic access to public election data
- Jurisdictions with no public data sources for a race score near 0 — complete absence of voter access is the most severe failure
- robots.txt restrictions on public election data are shown as a specific negative factor on the jurisdiction's accessibility page, so voters understand exactly what is being blocked and by whom
- Scores are recalculated once per election cycle; the last recalculation date is displayed
- Each state and local government page links directly to that jurisdiction's election officials so voters can engage about data gaps

**US-7.5**
- Each candidate profile displays the data accessibility score of the government source(s) used to build it
- The score links to the full government accessibility page
- When a source has a low accessibility score, a brief contextual note is shown explaining that the profile may be incomplete due to data availability

---

## Out of Scope (MVP)

The following are explicitly deferred from the initial release:

| Item | Reason |
|---|---|
| User accounts and authentication | Discovery specifies anonymous-only; accounts add complexity and privacy risk |
| Personalized notifications or alerts | No accounts means no notification mechanism |
| Ballot measures and referendum tracking | Scope limited to candidate research for MVP |
| Recall elections | Deferred until candidate election coverage is stable |
| Social media data (X/Twitter, Facebook, Instagram, etc.) | Data access is uncertain; scraping rules are unclear; deferred until legal and technical feasibility is confirmed |
| Comparison of more than two candidates simultaneously | Three-plus candidate comparison deferred; two-candidate comparison is MVP |
| Data export (CSV, PDF) | Deferred; useful for journalists but not core to MVP voter experience |
| Historical election data (prior cycles) | Post-MVP planned scope — historical elections repository confirmed; concluded races and withdrawn candidate profiles archived at end of each cycle, browsable by state, office, and year |
| International elections | Discovery specifies US-only for initial version |
| Native mobile app (iOS / Android) | Web app is responsive; native apps are deferred |
| API access for external researchers or third parties | Deferred until the product is stable and demand is confirmed |
| Monetization features (ads, premium tier) | Deferred; not a launch requirement |
| Admin dashboard for manual data entry or overrides | Deferred; MVP assumes automated data collection only |

---

## Prioritization

### MoSCoW Framework

#### Must Have (MVP launch blockers)

- Geolocation-based district identification
- Zip code fallback for geolocation denial
- Race and candidate dashboard with correct grouping by government level
- Candidate profile with verifiable facts and source links
- All four candidate ratings (Transparency, Sentiment, Factual Consistency, Campaign Finance)
- News sentiment breakdown by outlet type
- Data freshness timestamp
- "Limited Data Available" indicator
- Ratings methodology documentation page
- State Data Accessibility Rankings
- Local Government Data Accessibility Rankings

#### Should Have (high value, not MVP blockers)

- Side-by-side candidate comparison
- District confirmation display (showing user their resolved districts)
- Candidate status indicators (Active, Withdrawn, Elected)
- Link from candidate profile to government data accessibility score
- Minimum article threshold enforcement for sentiment scores
- User-visible explanation of scoring criteria on accessibility rankings page

#### Could Have (add value if time permits)

- User's detected state highlighted in state accessibility rankings
- Direct URL linking to specific candidate profiles (shareable links)
- Tooltip or inline help text on ratings
- "Insufficient coverage data" displayed per outlet category (rather than per candidate overall)

#### Will Not Have (deferred, see Out of Scope)

- User accounts
- Social media data
- Ballot measures
- Data export
- Native mobile apps
- Historical election data
- Third-party API access

---

## Product Risks

| Risk | Impact | Notes |
|---|---|---|
| Government data coverage is uneven across states | High | Some states have no machine-readable data; this directly limits profile quality and may make ratings unreliable for many candidates |
| Outlet categorization (left / right / neutral) may itself be perceived as biased | High | Any reference list used will be contested by some; methodology must be transparent and the reference source clearly documented |
| Sentiment analysis methodology carries inherent statistical uncertainty | Medium | Equal application across candidates reduces relative bias but does not eliminate algorithmic limitations |
| Local candidate data is extremely sparse | High | School board, water district, and similar races may produce profiles that are almost entirely "Limited Data Available" — eroding user trust if not handled carefully |
| Legal and terms-of-service questions around scraping are unresolved | High | Scraping state election sites and news outlets may violate ToS; this is a launch blocker that must be resolved in technical and legal review |
| Geolocation accuracy near district boundaries | Medium | A user near a boundary may be placed in the wrong district; the manual fallback partially mitigates this |
| User trust in neutrality claims | High | If any content decision appears partisan, the product's core value proposition collapses; methodology transparency is the primary mitigation |
| Data freshness failures | Medium | If the daily refresh pipeline fails, users may be viewing stale data during active election periods; freshness indicators are the primary user-facing signal |
| Infrastructure cost at scale | Medium | Daily refresh pipelines across thousands of candidates and news sources may be expensive; not a launch risk but a growth risk |
| Ratings may oversimplify complex political records | Medium | A numeric score for a politician's record invites criticism; plain-language context and source links are key mitigations |

---

## Open Questions

The following questions from business process discovery remain unresolved and must be answered before or during technical design. Additional product-level questions are added below.

### Carried from Discovery

- ~~What data source maps lat/long to voting districts across federal, state, and local levels?~~ **RESOLVED:** Cicero API (primary), Census TIGER/Line shapefiles (fallback).
- Which states have machine-readable, publicly accessible candidate filing data? *(Still open — to be mapped in technical design)*
- ~~For states without structured data, how will candidate data be collected?~~ **RESOLVED:** HTML scraping with legal safeguards. Before scraping any site, the scraper checks for a robots.txt file and respects all `Disallow:` paths. Rate limiting and per-source ToS review also apply. Paths blocked by robots.txt are not scraped. Sites that use robots.txt to block public election data have that restriction counted against their Data Accessibility Score.
- ~~Does the app cover primaries and special elections, or general elections only?~~ **RESOLVED:** Primaries, special elections, and general elections are all in scope.
- ~~How are news outlets categorized as left-leaning, right-leaning, or neutral?~~ **RESOLVED:** Textbook political science definitions of conservative (right-leaning), liberal (left-leaning), and neutral. Definitions and sources documented on the methodology page. How the categorization list is kept current over time is still open.
- ~~What is the minimum article count required before a Sentiment Score is displayed?~~ **RESOLVED:** 50 articles per outlet category minimum. Below 50, that category shows "Insufficient coverage data."
- ~~How far back in time does news sentiment analysis go?~~ **RESOLVED:** Back to the last election cycle for the office in question.
- ~~What is the exact criteria set for the State Data Accessibility Score?~~ **RESOLVED:** Proprietary benchmarked method — states with the most accessible public data systems anchor 100%; states with the least anchor ~0%. All others scored relative to those anchors by number of accessible public systems. Methodology published on the methodology page.
- ~~How often are government accessibility scores recalculated?~~ **RESOLVED:** Once per election cycle. Not daily — government infrastructure changes slowly.
- How is the Factual Consistency Score calculated for candidates with no voting record?
- How is the Transparency Score scaled and what data points contribute to it?
- How is the Campaign Finance Score calculated, and what makes a score high versus low?
- Does scraping state election board websites violate their Terms of Service?
- Does scraping news sources for sentiment analysis require licensing agreements?
- Are there political advertising laws or disclaimer requirements that apply to this tool?
- What is the fallback when a state's election board data is unavailable or unstructured?
- How will the app handle very small local races that do not appear in any known data source?
- What happens when a user is near a district boundary and geolocation is imprecise?
- Should users be able to manually override their detected district (beyond the zip code fallback)?
- Which social media platforms would be included in a future scope expansion?

### New Product Questions

- Should the ratings methodology page be a static document or dynamically reflect the current version with a changelog?
- When a candidate withdraws after data has been collected, how long should the profile remain accessible?
- Should concluded races be hidden from the dashboard by default, or shown with a Concluded label?
- Should the app display upcoming races where filing is still open but candidates may not yet be finalized?
- Is there a minimum data confidence threshold below which ratings should not be displayed at all, rather than shown with a "Limited Data" qualifier?
- Should the local government accessibility rankings show only governments within the user's detected area, or all local governments in the user's state?
- Should the accessibility rankings page link to a resource or contact point voters can use to advocate for better data access in their jurisdiction?
- How should the app handle candidates who have the same name in the same or overlapping districts?
- Should the methodology documentation page carry a version number so users and researchers can reference a specific version?
