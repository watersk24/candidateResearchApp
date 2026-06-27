# UX Design

**Status:** Draft
**Date:** 2026-06-27
**Based on:** Business Process Discovery and Product Requirements documents

---

## User Journeys

---

### Journey 1: Everyday Voter — Quick Candidate Lookup (Primary Path)

**Persona:** Everyday Voter
**Goal:** Find out basic facts about a candidate on the ballot before voting
**Entry point:** Direct URL or shared link, usually on mobile

1. User opens the app in a mobile browser
2. App immediately requests browser geolocation permission
3. User taps "Allow"
4. App shows a brief loading state ("Finding your races...")
5. Dashboard loads — all races grouped by Federal, State, Local
6. User sees familiar race names (e.g., "U.S. Senate — Colorado") and scans for a candidate name they recognize
7. User taps a candidate name
8. Candidate profile page loads
9. User sees the four rating icons near the top — taps the Transparency Score icon
10. A popup opens explaining how the score was calculated; user reads it and taps a link to the methodology page if curious
11. User scrolls down and scans the campaign finance summary and public statements sections
12. User taps a source link on a public statement to verify it
13. User returns to the dashboard (back navigation)
14. User taps a second candidate in the same race
15. User reads that profile quickly and returns
16. Session ends — no account, no saved data

**What the Everyday Voter does NOT do:** Read the full methodology page, use the comparison feature, or explore accessibility rankings.

---

### Journey 2: Engaged Voter — Deep Research and Comparison

**Persona:** Engaged Voter
**Goal:** Thoroughly evaluate two candidates in the same state legislative race and compare them

1. User opens the app on a desktop browser
2. App requests geolocation; user allows it
3. Dashboard loads; user confirms their detected districts are correct by reading the district confirmation panel
4. User finds the state legislative race they care about
5. User taps the first candidate name
6. Profile loads — user reads voting record section carefully, clicks multiple source links
7. User reads campaign finance section and checks donor composition breakdown
8. User taps the Factual Consistency Score icon — popup explains the threshold and methodology; user taps through to the full methodology page to read the scoring criteria
9. User reads the Sentiment Score breakdown — notes that coverage is heavier on liberal outlets and the neutral outlet count is below threshold ("Insufficient coverage data" shown for neutral)
10. User taps "Compare" from this profile, then selects the opposing candidate
11. Comparison view loads — both candidates shown side by side
12. User scans ratings, sentiment breakdowns, and legal history sections in parallel columns
13. User notices the "Limited Data Available" qualifier on the second candidate's Factual Consistency Score — reads the brief contextual note
14. User navigates to the State Data Accessibility Rankings from the link on the candidate profile
15. User finds their state ranked and reads the scoring breakdown
16. User taps the link to that state's election officials to find contact information
17. User returns and shares a direct URL to one of the candidate profiles

---

### Journey 3: Journalist / Researcher — Structured Research Starting Point

**Persona:** Journalist or Researcher
**Goal:** Build a sourced starting point for a story about a specific local race and assess how complete the data is

1. User opens the app on a desktop browser
2. User allows geolocation — or searches manually by zip code if researching a jurisdiction outside their own
3. Dashboard loads; user identifies the race they are covering
4. User opens multiple candidate profiles in separate tabs
5. On each profile, user reviews the data freshness timestamp and checks for stale data warnings
6. User checks the "Limited Data Available" indicator status and reads any contextual notes about why data is sparse
7. User systematically clicks source links on voting record and campaign finance entries to verify that links resolve correctly
8. User reads the full ratings methodology page (linked from rating popups)
9. User checks the Local Government Data Accessibility Rankings to understand whether the jurisdiction is a known data gap
10. User reads the robots.txt restriction note if one appears on the accessibility page
11. User notes the election officials contact link for follow-up reporting
12. User copies the direct URL to each candidate profile for citation purposes

---

## Screen List

| # | Screen Name | Purpose |
|---|---|---|
| 1 | Location Permission Screen | Request geolocation or prompt zip code entry on first load |
| 2 | Zip Code Fallback Screen | Allow manual zip code entry when geolocation is denied or fails |
| 3 | Dashboard | Show all races grouped by level for the user's detected location |
| 4 | District Confirmation Panel | Show the user which districts were resolved for their location |
| 5 | Candidate Profile | Full research profile for a single candidate |
| 6 | Rating Popup (per rating) | In-context explanation of how a specific score was calculated |
| 7 | Candidate Comparison View | Side-by-side display of two candidate profiles |
| 8 | State Data Accessibility Rankings | Ranked list of all 50 states by data accessibility score |
| 9 | Local Government Accessibility Rankings | Data accessibility scores for local governments in the user's area |
| 10 | Accessibility Detail Page (per jurisdiction) | Breakdown of a specific jurisdiction's accessibility score and criteria |
| 11 | Methodology Page | Full plain-language documentation of all four rating methodologies |
| 12 | Error Screen | Displayed when a critical failure occurs (profile not found, service down) |

---

## Screen Designs

---

### Screen 1: Location Permission Screen

**Purpose:** Request geolocation permission and explain why it is needed before any race data is shown.

**When shown:** On first app load, before any race data is displayed.

**Layout:**

```
+-----------------------------------------------+
|  [App Logo / Name]                            |
|                                               |
|  Find your races                              |
|  We use your location to show you every       |
|  race on your ballot — federal, state, and    |
|  local. No account required. Your location    |
|  is never stored.                             |
|                                               |
|  [Allow Location Access]  (primary button)    |
|                                               |
|  or                                           |
|                                               |
|  [Enter my zip code instead]  (text link)     |
|                                               |
+-----------------------------------------------+
```

**Key elements:**
- App name/logo centered at top
- Plain-language explanation of why location is needed and what is NOT done with it (trust signal)
- Primary button triggers the browser geolocation prompt
- Secondary option (text link) bypasses geolocation entirely and goes to Zip Code Fallback Screen
- No other navigation present — this is the entry gate

**User actions:**
- Tap "Allow Location Access" → browser geolocation prompt appears
- Tap "Enter my zip code instead" → goes to Zip Code Fallback Screen

**Edge cases handled here:**
- If the browser geolocation prompt is dismissed without a choice, re-show this screen with the secondary option more prominent
- If geolocation is granted but resolves slowly, show a loading indicator ("Finding your districts...")

**Role differences:** None — all personas see the same screen.

---

### Screen 2: Zip Code Fallback Screen

**Purpose:** Allow manual district resolution when geolocation is denied, unavailable, or deliberately avoided.

**When shown:** When user taps "Enter my zip code instead" or when browser geolocation is denied.

**Layout:**

```
+-----------------------------------------------+
|  [< Back]                                     |
|                                               |
|  Enter your zip code                          |
|  We will use this to find all races in        |
|  your area. Your zip code is not stored.      |
|                                               |
|  [___________]  (zip code input)              |
|  [Find my races]  (submit button)             |
|                                               |
|  [Error message if invalid — shown inline]    |
|                                               |
+-----------------------------------------------+
```

**Key elements:**
- Back link to return to Location Permission Screen (in case user wants to try geolocation instead)
- Numeric input field (5-digit US zip code)
- Submit button
- Inline error area (shown only when input is invalid)
- Privacy reassurance ("Your zip code is not stored")

**User actions:**
- Enter zip code → tap submit → loading state → Dashboard
- Enter invalid zip code → inline error message ("Please enter a valid 5-digit US zip code")
- Tap back → Location Permission Screen

**Error cases:**
- Invalid or non-US zip code: inline error, field stays focused
- Zip code resolves but produces no races: show Dashboard with empty state

**Role differences:** None — all personas see the same screen.

---

### Screen 3: Dashboard

**Purpose:** Show the user every active race in their area, grouped by government level, so they can navigate to any candidate.

**When shown:** After successful geolocation or zip code resolution.

**Layout (desktop):**

```
+-------------------------------------------------------+
|  [App Logo]        [State Rankings]  [Methodology]   |
+-------------------------------------------------------+
|  Your Races — [City, State]                           |
|  Districts: [US House 7] [State Senate 22] [more...]  |
|  [Refine location] (link)                             |
+-------------------------------------------------------+
|                                                       |
|  FEDERAL                                              |
|  +-------------------------------------------------+  |
|  |  U.S. Senate — Colorado           [Active]      |  |
|  |  Election: November 3, 2026                     |  |
|  |  > Jane Smith (D)  [Active]                     |  |
|  |  > Robert Nguyen (R)  [Active]                  |  |
|  |  > Carol Patel (I)  [Active]                    |  |
|  +-------------------------------------------------+  |
|  |  U.S. House — District 7          [Active]      |  |
|  |  ...                                            |  |
|  +-------------------------------------------------+  |
|                                                       |
|  STATE                                                |
|  +-------------------------------------------------+  |
|  |  State Senate — District 22       [Active]      |  |
|  |  ...                                            |  |
|  +-------------------------------------------------+  |
|                                                       |
|  LOCAL                                                |
|  +-------------------------------------------------+  |
|  |  County Commissioner — District 3 [Active]      |  |
|  |  > Marcus Avery (D)  [Active]                   |  |
|  |  > Lena Torres  [Withdrawn]                     |  |
|  +-------------------------------------------------+  |
|  |  School Board — At-Large          [Active]      |  |
|  |  [Limited Data Available]                       |  |
|  |  ...                                            |  |
|  +-------------------------------------------------+  |
|                                                       |
|  Data last refreshed: June 27, 2026 at 6:00 AM       |
|                                                       |
+-------------------------------------------------------+
```

**Layout (mobile — stacked, same sections collapsed by default):**

```
+----------------------------------+
|  [Logo]         [Menu icon]      |
+----------------------------------+
|  Your Races — Denver, CO         |
|  [Districts pill chips]          |
+----------------------------------+
|  FEDERAL  [v collapse]           |
|  U.S. Senate — CO   [Active]     |
|  > Jane Smith (D)                |
|  > Robert Nguyen (R)             |
+----------------------------------+
|  STATE  [v]                      |
|  ...                             |
+----------------------------------+
|  LOCAL  [v]                      |
|  ...                             |
+----------------------------------+
```

**Key elements:**
- Global navigation: App logo (home), State Rankings link, Methodology link
- Location header showing resolved city/state
- District confirmation chips (compact, tappable to expand the District Confirmation Panel)
- "Refine location" link (goes to Zip Code Fallback Screen)
- Races grouped by Federal / State / Local — each group is a collapsible section
- Each race: office name, election date, status badge, list of candidates
- Each candidate name: tappable link to Candidate Profile
- Candidate status badges: Active (green), Withdrawn (grey with strikethrough), Elected (blue)
- Race status badges: Active, Upcoming, Concluded
- "Limited Data Available" indicator on races where data is sparse — shown at the race level, not hidden
- Global data freshness timestamp at page footer
- No login, no search bar (MVP)

**User actions:**
- Tap candidate name → Candidate Profile
- Tap "Compare" button next to a candidate name (should-have feature) → begins comparison flow
- Tap district chips → expands District Confirmation Panel
- Tap "Refine location" → Zip Code Fallback Screen
- Tap "State Rankings" → State Data Accessibility Rankings
- Tap "Methodology" → Methodology Page
- Collapse/expand Federal/State/Local groups
- Tap race status badge → tooltip explaining status definition

**Role differences:**
- Everyday Voter: likely scans and taps a candidate name immediately
- Engaged Voter: checks district chips first, then navigates deliberately
- Journalist: may open multiple candidates in separate tabs

---

### Screen 4: District Confirmation Panel

**Purpose:** Give the user visibility into which voting districts were resolved from their location.

**When shown:** As a collapsible panel on the Dashboard, expanded automatically on first load for Engaged Voters and always available to any user.

**Layout:**

```
+-----------------------------------------------+
|  Your Districts                          [x]  |
|                                               |
|  Federal                                      |
|    US House of Representatives — District 7   |
|    US Senate — Colorado                       |
|                                               |
|  State                                        |
|    State Senate — District 22                 |
|    State House — District 41                  |
|                                               |
|  Local                                        |
|    Denver County Commissioner — District 3    |
|    Denver Public Schools — At-Large           |
|    Denver Water District                      |
|                                               |
|  [!] One district could not be confirmed.     |
|      Try entering your zip code for a more    |
|      precise match. [Refine location]         |
|                                               |
+-----------------------------------------------+
```

**Key elements:**
- List of all resolved districts grouped by government level
- Clear district names (not codes or abbreviations only)
- Warning message if any district could not be confidently resolved
- Link to Zip Code Fallback Screen when resolution is uncertain
- Dismissable panel (close button returns to Dashboard without the panel)

**User actions:**
- Read and verify district list
- Tap "Refine location" → Zip Code Fallback Screen
- Dismiss panel → Dashboard with panel collapsed

---

### Screen 5: Candidate Profile

**Purpose:** Display a comprehensive, source-linked profile for a single candidate.

**When shown:** When the user taps a candidate name from the Dashboard or Comparison flow.

**Layout (desktop):**

```
+-------------------------------------------------------+
|  [< Back to Dashboard]    [Compare] (button)          |
+-------------------------------------------------------+
|                                                       |
|  Jane Smith (D)                                       |
|  U.S. Senate — Colorado   [Active]                    |
|  Last refreshed: June 27, 2026 at 6:00 AM             |
|  Data source accessibility: Colorado — 72/100  [link] |
|                                                       |
|  [!] Limited Data Available (if applicable)           |
|  Some sections of this profile are incomplete         |
|  because [state] does not publish machine-readable    |
|  [data type]. See what is missing below.              |
|                                                       |
|  RATINGS                                              |
|  +----------------------+----------------------+      |
|  | Transparency         | 84/100          [?]  |      |
|  | Sentiment            | [breakdown]     [?]  |      |
|  | Factual Consistency  | 71/100          [?]  |      |
|  | Campaign Finance     | 63/100          [?]  |      |
|  +----------------------+----------------------+      |
|                                                       |
|  SENTIMENT BREAKDOWN                                  |
|  +-------------------------------------------------+  |
|  |  Conservative outlets  |  Positive  |  42 art. |  |
|  |  Liberal outlets        |  Neutral   |  87 art. |  |
|  |  Neutral outlets        |  [Insufficient — <50] |  |
|  +-------------------------------------------------+  |
|                                                       |
|  VOTING RECORD                                        |
|  +-------------------------------------------------+  |
|  |  Bill S.123 — Clean Energy Act    Yea   Jan 2025 |  |
|  |  [Source link]                                  |  |
|  |  Bill H.456 — Tax Reform Act      Nay   Oct 2024 |  |
|  |  [Source link]                                  |  |
|  |  [Show more...]                                  |  |
|  +-------------------------------------------------+  |
|                                                       |
|  CAMPAIGN FINANCE                                     |
|  +-------------------------------------------------+  |
|  |  Total raised:  $1,245,000                      |  |
|  |  Individual donors:  62%  [Source]              |  |
|  |  PAC donations:  31%  [Source]                  |  |
|  |  Party transfers:  7%  [Source]                 |  |
|  |  Disclosure completeness:  All filings current  |  |
|  |  [Source: FEC filing link]                      |  |
|  +-------------------------------------------------+  |
|                                                       |
|  PUBLIC STATEMENTS                                    |
|  +-------------------------------------------------+  |
|  |  "Quote..." — Jan 15, 2025                      |  |
|  |  Source: Official Senate transcript  [link]     |  |
|  +-------------------------------------------------+  |
|                                                       |
|  LEGAL HISTORY                                        |
|  +-------------------------------------------------+  |
|  |  No legal history found in public records.      |  |
|  +-------------------------------------------------+  |
|                                                       |
|  BUSINESS AFFILIATIONS                                |
|  +-------------------------------------------------+  |
|  |  Smith Holdings LLC  |  Member  |  CO  [Source] |  |
|  +-------------------------------------------------+  |
|                                                       |
|  [Methodology page]                                   |
+-------------------------------------------------------+
```

**Layout (mobile — same sections, stacked vertically; ratings as a 2x2 icon grid):**

```
+----------------------------------+
|  [< Back]          [Compare]     |
+----------------------------------+
|  Jane Smith (D)                  |
|  U.S. Senate — CO   [Active]     |
|  Refreshed: Jun 27, 2026         |
|  Data: Colorado 72/100  [>]      |
+----------------------------------+
|  RATINGS                         |
|  [T] 84   [S] ---   (2 per row)  |
|  [F] 71   [CF] 63                |
+----------------------------------+
|  SENTIMENT                       |
|  Conservative: Positive (42)     |
|  Liberal: Neutral (87)           |
|  Neutral: Insufficient           |
+----------------------------------+
|  VOTING RECORD  [v]              |
|  ...                             |
+----------------------------------+
|  CAMPAIGN FINANCE  [v]           |
|  ...                             |
+----------------------------------+
|  PUBLIC STATEMENTS  [v]          |
|  ...                             |
+----------------------------------+
|  LEGAL HISTORY  [v]              |
|  No history found.               |
+----------------------------------+
|  BUSINESS AFFILIATIONS  [v]      |
|  ...                             |
+----------------------------------+
```

**Key elements:**
- Candidate name, party, office, race status badge — prominent at top
- Last refreshed timestamp (visible without scrolling)
- Data source accessibility score with link (e.g., "Colorado — 72/100") — links to State/Local Accessibility page
- "Limited Data Available" banner when applicable — positioned above ratings, never hidden
- Four ratings displayed as icons with score and clickable [?] icon each
- Sentiment breakdown as a structured table — three outlet rows, article count per row, "Insufficient coverage data" where applicable
- Voting record: tabular list, each row has bill/measure name, vote, date, source link; "Show more" pagination
- Campaign finance: summary figures with source links on each figure
- Public statements: each entry has quote excerpt, date, source type, source link
- Legal history: always shown; states "No legal history found in public records" if empty
- Business affiliations: always shown; states "No business affiliations found in public records" if empty
- Broken source links flagged inline ("Source link unavailable") — not silently dropped
- Methodology page link in footer
- [Compare] button — initiates comparison flow

**User actions:**
- Tap [?] icon on any rating → Rating Popup
- Tap source link on any data point → opens original source in new tab
- Tap data accessibility score → Accessibility Detail Page for that jurisdiction
- Tap [Compare] → Candidate Comparison flow
- Tap [< Back] → Dashboard
- Tap "Show more" on voting record → expands full list
- Tap section headers to collapse/expand on mobile

**Role differences:**
- Everyday Voter: scans ratings and sentiment; unlikely to click all source links
- Engaged Voter: reads all sections and clicks source links
- Journalist: systematically checks source link health and freshness timestamp

---

### Screen 6: Rating Popup (Per Rating)

**Purpose:** Explain in context how the rating displayed for this specific candidate was calculated, without requiring the user to leave the profile page.

**When shown:** When the user taps a [?] icon adjacent to any of the four ratings.

**Layout (modal overlay):**

```
+-----------------------------------------------+
|  Transparency Score                      [x]  |
|  Jane Smith — 84 / 100                        |
|                                               |
|  How this score is calculated:                |
|                                               |
|  Profile data completeness    38 / 40         |
|  Finance filing compliance    27 / 30         |
|  Public record depth          14 / 20         |
|  Data currency                 5 / 10         |
|                               -------         |
|  Total                        84 / 100        |
|                                               |
|  [Read full methodology]  (link)              |
+-----------------------------------------------+
```

**Sentiment Score popup variant:**

```
+-----------------------------------------------+
|  Sentiment Score                         [x]  |
|  Jane Smith                                   |
|                                               |
|  How sentiment is measured:                   |
|  News articles are categorized by outlet type |
|  using textbook political science definitions.|
|  Each outlet type is scored separately.       |
|                                               |
|  Conservative outlets:  Positive  (42 articles)|
|  Liberal outlets:       Neutral   (87 articles)|
|  Neutral outlets:       Insufficient coverage |
|                         (fewer than 50 articles)|
|                                               |
|  Coverage period: Since last election cycle   |
|  (November 2022)                              |
|                                               |
|  [Read full methodology]  (link)              |
+-----------------------------------------------+
```

**Factual Consistency Score popup variant — New Candidate:**

```
+-----------------------------------------------+
|  Factual Consistency Score               [x]  |
|  Alex Rivera                                  |
|                                               |
|  New Candidate / Minimal Voting Record        |
|                                               |
|  This candidate has fewer than 10 recorded    |
|  votes. A Factual Consistency Score requires  |
|  a minimum of 10 votes to calculate reliably. |
|                                               |
|  Incumbents are always scored regardless of   |
|  vote count. This candidate is not an         |
|  incumbent.                                   |
|                                               |
|  [Read full methodology]  (link)              |
+-----------------------------------------------+
```

**Campaign Finance Score popup:**

```
+-----------------------------------------------+
|  Campaign Finance Score                  [x]  |
|  Jane Smith — 63 / 100                        |
|                                               |
|  How this score is calculated:                |
|                                               |
|  Filing availability:         All required    |
|  (Are mandated filings filed?)  filings found |
|                                               |
|  Donation/expenditure match:  Minor           |
|  (Do reported donations match  discrepancies  |
|  reported expenditures?)       found          |
|                                               |
|  Note: Campaign Finance Score methodology     |
|  is evolving. See the methodology page for    |
|  current criteria and known limitations.      |
|                                               |
|  [Read full methodology]  (link)              |
+-----------------------------------------------+
```

**Key elements:**
- Modal overlay (does not navigate away from profile)
- Candidate name and score prominently shown
- Component breakdown visible for scores with sub-components
- For Factual Consistency: clear explanation of threshold rule
- "Read full methodology" link on every popup
- Close button [x] in top-right corner

**User actions:**
- Tap [x] or tap outside modal → closes popup, returns to profile
- Tap "Read full methodology" → Methodology Page (new tab or navigation)

---

### Screen 7: Candidate Comparison View

**Purpose:** Display two candidate profiles side by side so differences are immediately visible without narrative framing.

**When shown:** When the user initiates a comparison from a candidate profile or dashboard.

**Initiation flow:**
- User taps [Compare] on a candidate profile
- A prompt appears: "Select a second candidate to compare"
  - The user's current race candidates are shown as quick-select chips
  - A search input allows selecting any candidate from any race
- After selection, the comparison view loads

**Layout (desktop — two columns):**

```
+-------------------------------------------------------+
|  [< Back]                                             |
|  Comparing candidates                                 |
|  [Change Candidate A] v    [Change Candidate B] v     |
+-------------------------------------------------------+
|                         |                             |
|  Jane Smith (D)         |  Robert Nguyen (R)          |
|  U.S. Senate — CO       |  U.S. Senate — CO           |
|  [Active]               |  [Active]                   |
|                         |                             |
|  Transparency           |  Transparency               |
|  84 / 100  [?]          |  61 / 100  [?]              |
|                         |                             |
|  Sentiment              |  Sentiment                  |
|  Conservative: Pos(42)  |  Conservative: Pos(91)      |
|  Liberal: Neu (87)      |  Liberal: Neg (103)         |
|  Neutral: Insufficient  |  Neutral: Neutral (55)      |
|                         |                             |
|  Factual Consistency    |  Factual Consistency        |
|  71 / 100  [?]          |  58 / 100  [?]              |
|                         |                             |
|  Campaign Finance       |  Campaign Finance           |
|  63 / 100  [?]          |  [!] Limited Data  [?]      |
|                         |                             |
|  --- Voting Record ---  |  --- Voting Record ---      |
|  Bill S.123  Yea        |  Bill S.123  Nay            |
|  Bill H.456  Nay        |  Bill H.456  Yea            |
|                         |                             |
|  --- Campaign Finance --|  --- Campaign Finance ---   |
|  Individuals: 62%       |  Individuals: 41%           |
|  PACs: 31%              |  PACs: 52%                  |
|                         |                             |
|  --- Legal History ---  |  --- Legal History ---      |
|  None found.            |  None found.                |
|                         |                             |
|  --- Business Aff. ---  |  --- Business Aff. ---      |
|  Smith Holdings LLC     |  Nguyen Enterprises LLC     |
|                         |                             |
+-------------------------------------------------------+
```

**Layout (mobile — two narrow columns, abbreviated labels; horizontal scroll allowed):**

- Candidate names fixed at top
- Sections scroll vertically with both columns in sync
- Rating icons shown above scores on mobile (compact)

**Key elements:**
- Two-column layout — candidate A and candidate B
- Column header: name, party, office, status badge
- All four ratings in parallel with [?] icons on each
- Sentiment breakdown by outlet type — per column, not aggregated
- Key factual categories (voting record, campaign finance, legal history, business affiliations) shown in parallel rows — source links preserved
- "Limited Data" qualifier preserved in comparison columns
- "Insufficient coverage data" preserved per outlet type per column
- Dropdowns at the top of each column to change the selected candidate without leaving the view

**User actions:**
- Tap [?] on any rating → Rating Popup for that candidate
- Tap source link on any data point → opens source in new tab
- Use candidate dropdowns to change either candidate
- Tap [< Back] → returns to the profile of candidate A
- Tap section headers to collapse/expand on mobile

**Role differences:**
- Everyday Voter: likely uses this to read a quick side-by-side of two names they heard
- Engaged Voter: uses this extensively, reads all sections and source links

---

### Screen 8: State Data Accessibility Rankings

**Purpose:** Show all 50 states ranked by their data accessibility score, surfacing government transparency gaps as a civic accountability tool.

**When shown:** Navigated to from global nav, candidate profile, or accessibility detail pages.

**Layout:**

```
+-------------------------------------------------------+
|  [< Back]                                             |
|  State Data Accessibility Rankings                    |
|  How well does each state publish candidate and       |
|  election data for voters?                            |
|                                                       |
|  Scores are benchmarked across all 50 states.         |
|  The highest-access states anchor 100%.               |
|  The lowest-access states anchor near 0%.             |
|  Last scored: January 2026 (updated each election     |
|  cycle)                                               |
|                                                       |
|  What does this score measure? [expand]               |
|  (Scoring criteria: public availability, machine-     |
|  readable formats, free access, timeliness, voting    |
|  record availability, campaign finance detail,        |
|  robots.txt restrictions on public election data)     |
|                                                       |
|  [Your state: Colorado — highlighted]                 |
|                                                       |
|  Rank  State           Score     robots.txt?          |
|  --------------------------------------------------   |
|  1     Oregon          100                            |
|  2     California       94                            |
|  3     New York         91                            |
|  ...                                                  |
|  [Your state]                                         |
|  22    Colorado         72       [No restrictions]    |
|  ...                                                  |
|  48    Louisiana        18       [Restrictions noted] |
|  49    Mississippi      11                            |
|  50    Wyoming           4       [Restrictions noted] |
|  --------------------------------------------------   |
|                                                       |
|  [Tap any state to view its full accessibility page]  |
|                                                       |
+-------------------------------------------------------+
```

**Key elements:**
- Brief explanation of what the ranking measures — shown prominently above the table
- Scoring criteria expandable section (not hidden in a separate page for this top-level view)
- "Last scored" date visible — election cycle cadence noted
- Table: rank, state name, score (0–100), robots.txt restriction indicator
- User's detected state is visually highlighted (color or marker)
- Each state row is tappable — links to Accessibility Detail Page for that state
- Benchmarking methodology note: highest-access states anchor 100%, lowest anchor ~0%

**User actions:**
- Tap any state row → Accessibility Detail Page for that state
- Tap "Methodology" link → Methodology Page
- Tap [< Back] → Dashboard or referring page

---

### Screen 9: Local Government Accessibility Rankings

**Purpose:** Show the data accessibility scores for local governments in the user's area, enabling local civic advocacy.

**When shown:** Navigated to from the candidate profile, dashboard, or global nav.

**Layout:**

```
+-------------------------------------------------------+
|  [< Back]                                             |
|  Local Government Data Accessibility                  |
|  Denver Metro Area                                    |
|                                                       |
|  Scores reflect how well local governments publish    |
|  candidate and election data. Last scored: Jan 2026.  |
|                                                       |
|  TYPE            JURISDICTION               SCORE     |
|  ---------------------------------------------------  |
|  County          Denver County              68        |
|  City            City of Denver             71        |
|  School District Denver Public Schools      34        |
|  Special Dist.   Denver Water District      12        |
|                                                       |
|  [Tap any row to view details and contact officials]  |
|                                                       |
+-------------------------------------------------------+
```

**Key elements:**
- Jurisdiction type, name, and score per row
- Tappable rows link to Accessibility Detail Page
- Low scores visually distinguished (e.g., color indicator)
- Scored once per election cycle; last scored date shown
- Area name shown in header (derived from user's location resolution)

**User actions:**
- Tap jurisdiction row → Accessibility Detail Page for that jurisdiction
- Tap [< Back] → Dashboard or referring page

---

### Screen 10: Accessibility Detail Page (Per Jurisdiction)

**Purpose:** Show the full breakdown of how a specific state or local government scored on data accessibility, including which criteria passed, which failed, and how to contact election officials.

**When shown:** Tapped from State Rankings, Local Rankings, or a candidate profile link.

**Layout:**

```
+-------------------------------------------------------+
|  [< Back to Rankings]                                 |
|  Colorado — State Data Accessibility                  |
|  Score: 72 / 100                                      |
|  Last scored: January 2026                            |
|                                                       |
|  SCORING CRITERIA                                     |
|  +----------------------------------------------+    |
|  | Candidate filing data — publicly available   | Y  |
|  | Machine-readable format (not PDF only)        | Y  |
|  | Accessible without authentication or fees     | Y  |
|  | Updated in a timely manner                    | Y  |
|  | Voting records available and structured        | Y  |
|  | Campaign finance with sufficient detail        | P  | (partial)|
|  | robots.txt restrictions on election data       | N  |
|  +----------------------------------------------+    |
|                                                       |
|  [!] robots.txt Restriction Noted                     |
|  Colorado's Secretary of State website uses           |
|  robots.txt to restrict programmatic access to        |
|  [specific path]. This counts as a negative factor    |
|  in the accessibility score. Voters have a right      |
|  to access public election data through any means.    |
|                                                       |
|  Contact Election Officials                           |
|  Colorado Secretary of State — Elections Division     |
|  [Official website link]                              |
|  [Contact page link]                                  |
|                                                       |
|  You can use this information to contact your         |
|  election officials about improving public data       |
|  access in Colorado.                                  |
|                                                       |
+-------------------------------------------------------+
```

**Key elements:**
- Jurisdiction name, score, last-scored date prominent at top
- Scoring criteria table: each criterion listed with pass/fail/partial indicator
- robots.txt restriction — named explicitly as a negative factor when applicable, with specific path noted
- Election officials contact information: official website link and contact page link
- Brief call-to-action text encouraging voter engagement

**User actions:**
- Tap official website link → opens in new tab
- Tap contact page link → opens in new tab
- Tap [< Back] → returns to Rankings page

---

### Screen 11: Methodology Page

**Purpose:** Document in plain language how each of the four candidate ratings is calculated, what data sources are used, and how outlet categorization works.

**When shown:** Navigated to from any Rating Popup or global navigation.

**Layout:**

```
+-------------------------------------------------------+
|  [< Back]                                             |
|  Ratings Methodology                                  |
|  Version: 1.0   Last updated: 2026-06-27              |
|                                                       |
|  Our Commitment                                       |
|  Every rating on this site is calculated using the    |
|  same method for every candidate, regardless of party.|
|  All data is drawn from public government records.    |
|  No editorial judgment is applied.                    |
|                                                       |
|  TRANSPARENCY SCORE  (0–100)                          |
|  +-------------------------------------------------+  |
|  |  Component                           Weight     |  |
|  |  Profile data completeness           0–40 pts   |  |
|  |  Campaign finance filing compliance  0–30 pts   |  |
|  |  Public record depth                 0–20 pts   |  |
|  |  Data currency                       0–10 pts   |  |
|  +-------------------------------------------------+  |
|  Plain-language explanation of what each             |
|  component measures...                               |
|                                                       |
|  SENTIMENT SCORE                                      |
|  +-------------------------------------------------+  |
|  |  Outlet categorization reference: [source cited]|  |
|  |  Definitions used:                              |  |
|  |  - Conservative (right-leaning): [definition]  |  |
|  |  - Liberal (left-leaning): [definition]         |  |
|  |  - Neutral: [definition]                        |  |
|  |  Minimum article threshold: 50 per category     |  |
|  |  Coverage period: since last election cycle     |  |
|  |    for the office in question                   |  |
|  +-------------------------------------------------+  |
|                                                       |
|  FACTUAL CONSISTENCY SCORE  (0–100)                   |
|  +-------------------------------------------------+  |
|  |  Threshold: 10+ recorded votes required         |  |
|  |  New candidates: score not assigned             |  |
|  |  Incumbents: always scored                      |  |
|  |  What "consistency" means in this context...    |  |
|  +-------------------------------------------------+  |
|                                                       |
|  CAMPAIGN FINANCE SCORE  (evolving)                   |
|  +-------------------------------------------------+  |
|  |  Dimension 1: Filing availability               |  |
|  |  Dimension 2: Donation/expenditure accuracy     |  |
|  |  Note: This methodology is evolving and may be  |  |
|  |  refined as real-world data is evaluated.       |  |
|  +-------------------------------------------------+  |
|                                                       |
|  DATA ACCESSIBILITY SCORES                            |
|  Explanation of benchmarking methodology...           |
|  Explanation of scoring criteria...                   |
|  robots.txt restriction policy explained...           |
|                                                       |
+-------------------------------------------------------+
```

**Key elements:**
- Version number and last updated date — enables researchers to cite a specific version
- Opening commitment statement (neutrality, equal methodology, public records only)
- All four ratings documented in order with components/weights visible
- Sentiment outlet categorization reference cited with definitions
- Factual Consistency threshold and incumbent rule plainly stated
- Campaign Finance Score noted as evolving
- Data Accessibility scoring criteria and benchmarking approach explained

**User actions:**
- Read and scroll
- Tap [< Back] → returns to referring page (profile or popup origin)
- External links to cited methodology references open in new tabs

---

### Screen 12: Error Screen

**Purpose:** Display a meaningful message when a critical failure occurs, without exposing technical details.

**When shown:** When a candidate profile cannot be loaded, a service is unavailable, or geolocation resolution fails completely.

**Layout:**

```
+-----------------------------------------------+
|  [App Logo]                                   |
|                                               |
|  Something went wrong                         |
|                                               |
|  We were not able to load this page.          |
|  This may be a temporary issue.               |
|                                               |
|  [Try again]  (primary button)                |
|  [Go to Dashboard]  (secondary link)          |
|                                               |
+-----------------------------------------------+
```

**Variants:**
- Candidate profile not found: "This candidate profile is not available. The candidate may have withdrawn or the data may not yet have been collected."
- Stale data (global): banner at top of dashboard or profile — "Data refresh is overdue. The information shown may not reflect recent changes."
- Service unavailable: generic error with "Try again" and "Go to Dashboard"

---

## Workflow States

---

### Race States

| State | Definition | Displayed As |
|---|---|---|
| Active | Candidates are filed and election has not yet occurred | Green badge: "Active" |
| Upcoming | Election date is in the future; filing period may still be open | Yellow badge: "Upcoming" |
| Concluded | Election has occurred | Grey badge: "Concluded" |

**Dashboard behavior by race state:**
- Active: shown prominently, candidates fully listed
- Upcoming: shown but may have incomplete candidate list; note that filing is still open if applicable
- Concluded: shown with Concluded badge; candidates labeled Elected or not as applicable. Open question: whether concluded races are hidden by default (see Open Questions)

---

### Candidate States

| State | Definition | Displayed As |
|---|---|---|
| Active | Currently filed and running | Green badge: "Active" |
| Withdrawn | Filed but dropped out | Grey badge: "Withdrawn" — name shown with strikethrough or dimmed, profile retained |
| Elected | Won their race | Blue badge: "Elected" |

**Candidate profile behavior by state:**
- Active: full profile displayed
- Withdrawn: profile accessible but banner shown: "This candidate has withdrawn from the race. Profile data is retained for reference."
- Elected: profile accessible; banner could note "This candidate was elected in [election]"

---

### Data Record States

| State | Definition | UI Signal |
|---|---|---|
| Current | Refreshed within the last 24 hours | "Last refreshed: [timestamp]" — no warning |
| Stale | Not refreshed within 24 hours | Orange warning banner: "Data refresh is overdue — information may not reflect recent changes" |
| Limited Data Available | Insufficient public data exists | Yellow "Limited Data Available" badge on profile and rating |
| No Data | No public data exists for this candidate at all | Profile loads with "Limited Data Available" banner and all sections show their empty state messages |

---

### Rating States

| State | Definition | Displayed As |
|---|---|---|
| Scored | Sufficient data to calculate a rating | Numeric score (0–100) |
| Limited Data | Score calculated but on sparse data | Numeric score + "Limited Data" qualifier |
| New Candidate / Minimal Voting Record | Applies to Factual Consistency only; fewer than 10 votes | Text label replaces score |
| Insufficient Coverage | Applies to Sentiment per outlet type; fewer than 50 articles | "Insufficient coverage data" per outlet row |
| Not Applicable | A dimension does not apply to this candidate type | Text label explaining why |

---

## Happy Paths

---

### Happy Path 1: Everyday Voter — Find and Read a Candidate Profile

1. User opens app → Location Permission Screen
2. Taps "Allow Location Access" → browser geolocation granted
3. Loading state → Dashboard loads within a few seconds
4. User scans Federal section, taps a candidate name
5. Candidate Profile loads with all four ratings visible
6. User taps the Transparency Score [?] icon → Rating Popup opens
7. User reads popup, closes it
8. User scrolls down, reads public statements, clicks one source link → opens in new tab
9. User taps [< Back] → Dashboard
10. Session complete

**Expected time:** Under 2 minutes for this flow end to end.

---

### Happy Path 2: Engaged Voter — Compare Two Candidates

1. User opens app → geolocation granted → Dashboard loads
2. User reads District Confirmation Panel, confirms their districts are correct
3. User navigates to a state senate race, taps Candidate A
4. Candidate A profile loads; user reads all sections and clicks source links
5. User taps [Compare] → prompt to select Candidate B
6. User selects Candidate B from the same race
7. Comparison view loads with both candidates side by side
8. User reads all four ratings for both candidates
9. User taps [?] on Factual Consistency for Candidate B → popup explains "New Candidate / Minimal Voting Record"
10. User taps "Read full methodology" → Methodology Page opens
11. User navigates back to Comparison view
12. Session complete

---

### Happy Path 3: Journalist — Research a Local Race

1. User opens app → enters zip code (covering an area they are reporting on, not their own)
2. Dashboard loads for that zip code
3. User identifies a school board race
4. User opens both candidates in separate tabs
5. On each profile, user checks data freshness timestamp and "Limited Data Available" status
6. User clicks source links to verify they resolve correctly
7. User navigates to Local Government Accessibility Rankings → finds school district score of 34/100
8. User taps the school district row → Accessibility Detail Page
9. User reads scoring breakdown and notes robots.txt restriction
10. User taps the election officials contact link → opens in new tab
11. Session complete

---

### Happy Path 4: Any Persona — Read the Methodology

1. User is on a Candidate Profile
2. User taps [?] on Sentiment Score → Rating Popup opens
3. User reads the breakdown explanation
4. User taps "Read full methodology" → Methodology Page loads
5. User reads the full outlet categorization definitions and article threshold
6. User navigates back to the profile
7. Session complete

---

## Exception Paths

---

### Exception 1: Geolocation Denied

**Trigger:** User taps "Deny" on the browser geolocation prompt, or the browser blocks geolocation by policy.

**Flow:**
1. Browser returns geolocation denied error
2. Location Permission Screen updates to show: "Location access was denied. You can still find your races by entering your zip code."
3. Zip code input field appears below the message (or user is navigated to Zip Code Fallback Screen)
4. User enters zip code → normal dashboard flow continues

**What is NOT shown:** A blank screen, a technical error message, or a prompt to reload.

---

### Exception 2: Geolocation Granted but District Resolution Fails

**Trigger:** Coordinates are obtained but cannot be mapped to one or more voting districts.

**Flow:**
1. Loading state appears
2. Dashboard loads with whatever districts could be resolved
3. District Confirmation Panel shows: "[!] One or more districts could not be confirmed. Try entering your zip code for a more precise match. [Refine location]"
4. User can continue with partial results or tap "Refine location" to enter their zip code

---

### Exception 3: Limited Data — Candidate with Sparse Records

**Trigger:** Public data for this candidate is insufficient to fully populate the profile.

**What the user sees:**
- "Limited Data Available" banner below the candidate name header — cannot be missed, not collapsed
- A brief explanation: "Some sections are incomplete because [reason — e.g., 'this state does not publish machine-readable voting records']"
- Each affected section shows its empty state message rather than being hidden
- Ratings still displayed with "Limited Data" qualifier where applicable
- "New Candidate / Minimal Voting Record" shown for Factual Consistency if threshold not met
- Data freshness timestamp still shown

**What is NOT done:** Hiding sections or showing null/blank values without explanation.

---

### Exception 4: No Coverage for Sentiment Score

**Trigger:** Fewer than 50 articles exist for a given outlet type (or for all outlet types).

**What the user sees on profile:**
- Sentiment breakdown table is still shown
- Outlet types with insufficient coverage display "Insufficient coverage data" in their result column
- Article count is shown as the actual count (e.g., "12 articles analyzed — below threshold")
- If ALL outlet types are insufficient: all three rows show "Insufficient coverage data" — no aggregate score is fabricated

**What is NOT done:** Showing a default neutral score, hiding the sentiment section, or showing a score based on fewer than 50 articles without flagging it.

---

### Exception 5: Stale Data

**Trigger:** The data refresh pipeline has not run successfully in the last 24 hours.

**What the user sees:**
- Orange warning banner on the affected profile(s) or dashboard: "Data refresh is overdue. The information shown may not reflect recent changes. Last successfully refreshed: [timestamp]"
- The specific stale timestamp is shown — not a vague "recently"

**Stale data is never silently displayed without a warning.**

---

### Exception 6: Broken Source Link

**Trigger:** A source link on a candidate profile returns a 404 or is otherwise unavailable.

**What the user sees:**
- The data point is still shown (not deleted)
- Source link is replaced with: "Source link unavailable — original record may have moved or been removed"
- The data point itself is not removed — it was collected from a valid source; the link becoming unavailable does not invalidate the data

---

### Exception 7: Candidate Withdrawn After Data Collection

**Trigger:** A candidate who was Active withdraws after their profile has been built.

**What the user sees:**
- Dashboard: candidate name shown with "Withdrawn" badge; name optionally dimmed or struck through
- Profile: "This candidate has withdrawn from the race. Profile data is retained for reference." — shown as a banner above all content
- All data remains visible and accessible — no data is deleted

---

### Exception 8: Two Candidates with the Same Name

**Trigger:** Multiple candidates share a name in the same or overlapping districts.

**What the user sees on the dashboard:**
- Both names shown, each with their district and party label to disambiguate
- Format: "Jane Smith (D) — State House District 14" and "Jane Smith (R) — State Senate District 22"

---

### Exception 9: Zip Code Produces No Races

**Trigger:** A valid US zip code is entered but produces no active races.

**What the user sees:**
- Dashboard loads but shows empty state in all three groups (Federal, State, Local)
- Message: "We did not find any active races in your area. This may mean no candidates have filed yet, or that your area has no upcoming elections in our current data. [Try a different zip code]"

---

### Exception 10: State with No Machine-Readable Data

**Trigger:** A candidate is in a state that has no structured, machine-readable election data.

**What the user sees on the candidate profile:**
- "Limited Data Available" banner
- In the relevant section (e.g., voting record): "[State] does not publish machine-readable voting records. No voting data is available from public sources for this candidate."
- Data Accessibility Score link shown — likely low score, leading to the Accessibility Detail Page

**On the Accessibility Detail Page for that state:**
- Score near 0
- Scoring criteria table shows failures across all relevant criteria
- robots.txt restriction noted if applicable

---

## Empty States

Empty states are shown whenever a section has no data. Sections are never hidden — they always render with their empty state message when there is nothing to display. This prevents users from misinterpreting absence of a section as absence of data.

---

### Dashboard — No Races Found (Any Group)

**Shown when:** No active races exist for a given government level (Federal, State, or Local).

```
FEDERAL
  No federal races were found for your area in our current data.
  This may mean no federal seats are up for election this cycle.
```

---

### Candidate Profile — Voting Record — No Votes

**Shown when:** No voting record exists for a first-time candidate or a candidate in a race without available vote data.

```
No voting record available.

[For first-time candidates:]
This candidate has not previously held office. No voting record exists.

[For candidates in states without structured data:]
[State] does not publish machine-readable voting records.
No voting record data is available from public sources.
```

---

### Candidate Profile — Legal History — Nothing Found

**Shown when:** No entries appear in public court records for this candidate.

```
No legal history found in public records.

This does not indicate a definitive absence of legal history — only that no
entries were found in the public court records available to us. [Source note]
```

---

### Candidate Profile — Business Affiliations — Nothing Found

**Shown when:** No entries appear in public business registration records.

```
No business affiliations found in public records.

This reflects the publicly available business registration data we were
able to access. [Source note]
```

---

### Candidate Profile — Public Statements — Nothing Found

**Shown when:** No official transcripts, press releases, or public record statements are found.

```
No public statements found in official records.

Statements from campaign materials or candidate websites are not included
as sources for this section. Only government records and official transcripts
are used.
```

---

### Sentiment Breakdown — All Outlet Types Insufficient

**Shown when:** All three outlet types are below the 50-article threshold.

```
SENTIMENT BREAKDOWN

Conservative outlets:  Insufficient coverage data  (8 articles analyzed)
Liberal outlets:       Insufficient coverage data  (14 articles analyzed)
Neutral outlets:       Insufficient coverage data  (3 articles analyzed)

Not enough news coverage exists for this candidate to display a reliable
sentiment breakdown. The minimum threshold is 50 articles per outlet type.
```

---

### State Rankings — No State Detected

**Shown when:** The user's state cannot be determined from geolocation or zip code.

```
Your state could not be detected. All 50 states are shown below.
To highlight your state, [enter your location].
```

---

## Error States

Error states are distinct from empty states. Empty states reflect an absence of data. Error states reflect a system or technical failure.

---

### Geolocation Technical Failure (not denial)

**Shown when:** The browser returns an error other than denial (e.g., timeout, internal browser error).

```
We were not able to access your location due to a technical issue.
You can enter your zip code instead to find your races.

[Enter zip code]
```

---

### Profile Load Failure

**Shown when:** The candidate profile page cannot be loaded (network error, data service error).

```
This profile could not be loaded.

This may be a temporary issue. Try again in a moment.

[Try again]   [Go to Dashboard]
```

---

### District Resolution Service Failure

**Shown when:** The district mapping service returns an error.

```
We were not able to determine your voting districts right now.
This may be a temporary issue. You can enter your zip code to try again.

[Enter zip code]   [Try again]
```

---

### Rankings Page Load Failure

**Shown when:** The State or Local accessibility rankings page fails to load.

```
The rankings could not be loaded at this time.
This may be a temporary issue.

[Try again]   [Go to Dashboard]
```

---

### Data Refresh — Stale Data Warning (not a failure, but surfaced as an alert)

**Shown when:** Data has not been refreshed within 24 hours. This is a warning banner, not a blocking error.

```
[!] Data refresh overdue
The data on this profile has not been refreshed in the last 24 hours.
Information shown may not reflect recent changes.
Last refreshed: June 26, 2026 at 6:00 AM.
```

---

## Confirmation Messages

Because the app is anonymous and read-only (no user actions that modify data), traditional confirmation messages for form submissions, saves, or deletes do not apply. The following contextual confirmations apply instead.

---

### Location Accepted

**Shown after:** Geolocation is granted and districts are resolved.

```
[Loading indicator / transition message]
Finding your races in [City, State]...
```

No persistent confirmation needed — the dashboard loading is the confirmation.

---

### Zip Code Accepted

**Shown after:** A valid zip code is submitted and districts are resolved.

```
Showing races for zip code [XXXXX] — [City, State]
[If the area name cannot be resolved: "Showing races for zip code XXXXX"]
```

Displayed in the Dashboard location header — replaces the "Finding your races..." loading message.

---

### Invalid Zip Code

**Shown on:** Zip Code Fallback Screen, inline below the input field.

```
Please enter a valid 5-digit US zip code.
```

---

### Comparison Candidate Selected

**Shown when:** The user selects a second candidate to compare and the comparison view begins loading.

```
[Loading transition]
Comparing Jane Smith and Robert Nguyen...
```

No persistent confirmation — the comparison view loading is the confirmation.

---

### Source Link Unavailable (inline)

**Shown on:** Candidate profile, adjacent to any data point with a broken source link.

```
Source link unavailable — original record may have moved or been removed.
```

---

## Usability Notes

---

### Mobile-First Design

The app is expected to be used primarily on mobile devices, especially by Everyday Voters researching candidates close to an election. Every screen must be designed for a single-column mobile layout first, with desktop enhancements applied on wider viewports.

- Touch targets must be large enough to tap comfortably (minimum 44x44px interactive area)
- Text must remain legible without zooming on small screens
- Rating icons must be large enough to tap on mobile — not tiny clickable icons that require precision
- The Candidate Profile is long; sections should be collapsible on mobile to reduce scroll depth
- The Comparison View must handle two columns gracefully on narrow screens — horizontal scrolling is acceptable for comparison tables on mobile; the comparison is inherently a two-column layout and should not be collapsed into a single column
- The Dashboard race groupings should be collapsible on mobile so users can hide Federal if they are only interested in Local races
- Navigation back to the dashboard must always be accessible without scrolling back to the top

---

### Accessibility Basics

- All interactive elements must have descriptive labels accessible to screen readers (not just icon images without alt text)
- Rating [?] icons must have accessible labels: e.g., "Open Transparency Score explanation" — not just "?"
- Status badges must not rely solely on color to convey meaning — labels must be text-based, with color as a supplemental signal
- "Limited Data Available" and stale data warnings must be conveyed in text, not color alone
- Source link text should be descriptive (e.g., "FEC filing — October 2024") rather than raw URLs or generic "click here"
- Popup modals must trap focus while open and return focus to the triggering element when closed
- Section collapse/expand controls must be keyboard-navigable
- Error messages must be associated with their relevant form fields (for zip code input)

---

### Trust Signals

The primary risk to this product's value proposition is perceived bias. Every design decision should reinforce neutrality and methodological transparency.

- The methodology link must be visible on every screen that shows a rating — not buried in a footer
- Rating popups must appear immediately when tapped and explain clearly — not dismiss or require extra taps
- "Limited Data Available" must be prominent, not a subtle footnote
- Source links must be visible and clearly labeled on every data point — not hidden behind an expand/collapse
- The data freshness timestamp must always be visible on candidate profiles without scrolling
- The same visual weight and layout must be applied to all candidates regardless of party — no candidate should receive a layout advantage
- The methodology page must carry a version number so users and researchers can cite a specific version

---

### Navigation Model

- Global navigation is minimal: App logo (home/dashboard), State Rankings link, Methodology link
- No persistent left sidebar or complex nav structure — this is a read-only research tool
- All pages have a clear back navigation path
- Deep links to candidate profiles should be stable and shareable (direct URL per candidate)
- The comparison view does not have its own URL (open question — see below); users access it through a candidate profile

---

### Data Freshness Visibility

- Timestamp must always appear near the top of the candidate profile — above the fold on desktop, within the first scroll on mobile
- A stale data warning must never be collapsed, minimized, or hidden in an accordion
- The ratings are derived from data — if the data is stale, the ratings are effectively stale; the stale warning covers the full profile

---

### "Limited Data Available" Treatment

- Must appear as a visible banner or badge above the ratings section — not inline within a section the user may not scroll to
- Must explain briefly what is missing and why (e.g., "This state does not publish structured voting records")
- Must not prevent ratings from being displayed — ratings are still shown with their own "Limited Data" qualifier
- Absence of a section header must never be used to hide limited data — every section always renders

---

## Open Questions — RESOLVED

1. **Should concluded races be hidden from the dashboard by default, or shown with a Concluded badge?**
   **RESOLVED:** Show with a Concluded badge, collapsed by default on mobile. Reduces noise for Everyday Voters while keeping results visible for Journalists without hiding them.

2. **Should the comparison view have a stable, shareable URL?**
   **RESOLVED:** Yes. Comparison view gets a stable URL encoding the two selected candidates. Required for Journalist use case and Engaged Voter sharing.

3. **Should users be able to manually override their detected district beyond the zip code fallback?**
   **RESOLVED:** Yes. Users can manually select their district (e.g., "I am in State Senate District 14") to handle boundary cases and imprecise geolocation.

4. **Should concluded races show election results (who won)?**
   **RESOLVED:** Show the elected candidate as Elected — the "Elected" badge is applied prominently to their profile and name on the dashboard. No separate results display needed beyond the status badge.

5. **How long should a withdrawn candidate's profile remain accessible?**
   **RESOLVED:** Withdrawn candidate profiles remain visible until the end of the current election cycle, then are archived (moved to historical elections repository — see Q11).

6. **Should the Local Government Accessibility Rankings show only governments in the user's detected area, or all local governments in the user's state?**
   **RESOLVED:** Show all local governments in the user's state. Stretch goal: national map view where the user can navigate to any location and see accessibility scores for where they are looking (see Q12).

7. **Should the methodology documentation page carry a version number and changelog?**
   **RESOLVED:** Yes. Version number and last-updated date on the methodology page. Enables researchers to cite a specific version.

8. **Should there be a minimum data confidence threshold below which ratings are not displayed at all?**
   **RESOLVED:** Yes. If fewer than 5 data points exist for a rating, the score is not displayed. "Insufficient Data" label shown instead of a score. The "Limited Data" qualifier applies between 5 and the full data threshold.

9. **Should the Comparison View allow selecting candidates from different races?**
   **RESOLVED:** Yes. Any two candidates regardless of race. Cross-race candidate search input required — flagged for technical design.

10. **What is the sharing/linking mechanism for individual candidate profiles? Should the app link to or use the candidate's own website?**
    **RESOLVED:**
    - Candidate profiles have stable, shareable direct URLs.
    - Each profile includes a link to the candidate's official website, clearly labeled: "Candidate's Official Website (self-promotional — not used as a factual source)." Every candidate receives the same treatment regardless of party.
    - For candidates with minimal public data (especially local races), a minimal structured profile scaffold is built from filing data: name, party, office sought, contact information. This scaffold is the baseline — factual data and ratings are layered on top as they become available.
    - The candidate's official website is never used as a factual source for ratings or profile data sections.

11. **How should the app handle the transition from pre-election to post-election? Should there be a historical elections repository?**
    **RESOLVED:** Yes — a historical elections repository is confirmed scope (moved out of MVP deferred list). Concluded races and their candidate profiles are archived into the repository at the end of each election cycle. The repository is browsable by state, office, and election year. Withdrawn candidate profiles are archived here as well (per Q5). This is a post-MVP feature but is now planned scope.

12. **Should the State Data Accessibility Rankings page be the entry point for the full 50-state view, or is there a separate national map?**
    **RESOLVED:** National map confirmed as a feature. The ranked table remains the primary view. The national map is a stretch goal — users navigate the US map and see accessibility scores for the area they are viewing. Confirmed for both state accessibility rankings and as a potential future entry point for candidate/race discovery by location.
