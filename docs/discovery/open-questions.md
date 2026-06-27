# Open Questions

These questions remain unanswered from the discovery phase. They must be resolved before or during technical design.

---

## District Mapping

- ~~What data source maps latitude/longitude to voting districts across all levels (federal, state, local)?~~
  **RESOLVED:** Primary — Cicero API. Fallback — Census TIGER/Line shapefiles.
  The entire app depends on accurate district resolution; this critical dependency is now answered.

## Election Data

- Which states have machine-readable, publicly accessible candidate filing data?
  *(Still open — to be mapped during technical design)*
- ~~For states without APIs or structured data, how will candidate data be collected?~~
  **RESOLVED:** HTML scraping with legal safeguards (robots.txt compliance, rate limiting, ToS review per source, no bypassing access controls).
- ~~Does the app cover primaries and special elections, or general elections only?~~
  **RESOLVED:** Primaries, special elections, and general elections are all in scope.
- Does the app cover recall elections and ballot measures?
  *(Recall elections and ballot measures remain out of scope for MVP — see product requirements.)*

## News Sentiment

- ~~How are news outlets categorized as left-leaning, right-leaning, or neutral?~~
  **RESOLVED:** Categories are defined using textbook political science definitions of conservative (right-leaning), liberal (left-leaning), and neutral. This anchors categorization to established academic definitions rather than a third-party rating service, reducing the perception of bias in the methodology itself. The definitions and their sources must be documented on the methodology page.
  - How is the outlet categorization list kept current as outlets change over time? *(Still open — process needed)*

- ~~What is the minimum number of news articles required before a Sentiment Score is displayed?~~
  **RESOLVED:** Minimum 50 articles per outlet category. If fewer than 50 articles exist for a given category, that category displays "Insufficient coverage data."

- ~~How far back in time does news sentiment analysis go?~~
  **RESOLVED:** Back to the last election cycle for the office in question.

## Government Data Accessibility Scoring

- ~~What is the exact criteria set for the State Data Accessibility Score? Who defines it and how is it documented?~~
  **RESOLVED:** A proprietary scoring method benchmarked against real-world extremes. The state(s) with the most publicly accessible data systems anchor the 100% end; the state(s) with the least anchor the ~0% end. All other states are scored relative to those anchors based on the number of public systems available for voters to access candidate and election data. The criteria and methodology are documented and published on the methodology page.

- ~~How often are government accessibility scores recalculated?~~
  **RESOLVED:** Recalculated every election cycle. Government data infrastructure changes slowly; daily recalculation is unnecessary. A stale-data indicator is shown if a score has not been recalculated within the current cycle.

- ~~Should the accessibility score link to a specific contact or resource voters can use to report gaps to their government?~~
  **RESOLVED:** Yes. Each state and local government accessibility page links directly to that jurisdiction's election officials so voters have a clear path to engage.

- ~~How are local governments defined?~~
  **RESOLVED:** All of the above — county, city, school district, and special district are all included in local government coverage.

## Ratings Methodology

- ~~How is the Factual Consistency Score calculated for candidates with no voting record?~~
  **RESOLVED:** Factual Consistency Score accounts for time in office:
  - Fewer than 10 votes on record → labeled "New Candidate / Minimal Voting Record." No score assigned. No penalty.
  - 10 or more votes on record → scored on consistency between stated positions and voting record.
  - Incumbents are always scored regardless of vote count.

- ~~Will the ratings methodology be shown to users in plain language? Where?~~
  **RESOLVED:** A clickable icon on each rating opens a popup explaining how that specific score was calculated. A full methodology page also exists and is linked from each popup.

- ~~How is the Campaign Finance Score calculated? What makes a score high vs. low?~~
  **RESOLVED:** Based on legally mandated financial records. Measures two things:
  1. Availability — have all legally required filings been submitted?
  2. Accuracy — do reported donations match reported expenditures?
  This feature is marked as evolving and subject to refinement as real data is evaluated. The score reflects financial reporting accuracy and compliance, not the amounts themselves.

- ~~How is the Transparency Score scaled — what is the maximum, and what data points contribute to it?~~
  **RESOLVED:** 4-component, 0–100 scale. Measures how much the public *can know* about a candidate — not a judgment on what they have done.
  1. **Profile data completeness (0–40 pts):** How many expected data categories have data — voting record, campaign finance, public statements, legal history, business affiliations.
  2. **Campaign finance filing compliance (0–30 pts):** Have all legally required campaign finance reports been filed on time and completely?
  3. **Public record depth (0–20 pts):** Are public statements, official positions, and documented actions available and current relative to time in office?
  4. **Data currency (0–10 pts):** Are the available records recent, structured, and up to date?

## Legal and Compliance

- ~~Does scraping state election board websites violate their Terms of Service?~~
  **RESOLVED:** Before scraping any site, the scraper checks for a robots.txt file in the root of the site. Any path listed under `Disallow:` is not scraped. This is the primary legal safeguard.

  **Civic framing:** If a government site uses robots.txt to block access to public election data, that is itself a transparency failure. It counts against the jurisdiction's Data Accessibility Score — voters have a right to access data on the candidates they are asked to vote on. A government that actively restricts programmatic access to public election records scores lower than one that does not.

  If there are no public data sources for a local race at all — no accessible website, no structured data, no scrapable records — that jurisdiction's score reflects the complete absence of voter access. This is the most severe accessibility failure and scores near 0.

- Does scraping news sources for sentiment analysis require licensing agreements? *(Still open — to be reviewed per source in technical design)*
- Are there political advertising laws or disclaimer requirements that apply to a candidate research tool? *(Still open — legal review needed)*
- What data retention obligations exist if any user data (even anonymous) is collected? *(Still open — to be confirmed; MVP collects no user data)*

## Data Coverage

- What is the fallback when a state's election board data is not available or not structured?
- How will the app handle very small local races (e.g., school board, water district) that may not appear in any known data source?

## Geolocation Edge Cases

- What happens when a user is near a district boundary and geolocation is imprecise?
- Should users be able to manually override their detected district?

## Monetization (Future)

- If the app gains traction, what monetization model would be acceptable without compromising the neutrality commitment?
  - Options: Non-intrusive ads, premium data export, nonprofit/grant-funded, API access for researchers
- Would monetization require user accounts at that point?

## Social Media

- Which social media platforms will be included? (X/Twitter, Facebook, Instagram, others?)
- Do the platforms' public APIs provide enough data without requiring authentication?
- How is social media content handled for candidates who are not active on social media?
