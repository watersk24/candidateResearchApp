import Nav from "@/components/Nav";

export const metadata = { title: "Ratings Methodology — Candidate Research" };

export default function MethodologyPage() {
  return (
    <>
      <Nav />
      <main className="flex-1 mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900 mb-3">Ratings Methodology</h1>
        <p className="text-slate-500 text-sm leading-relaxed max-w-prose mb-8">
          The same methodology is applied equally to every candidate regardless of party affiliation.
          All ratings are computed from publicly available government and official records only.
        </p>

        <div className="space-y-8 text-sm text-slate-700">
          <section>
            <h2 className="font-semibold text-slate-900 mb-2">Transparency Score (0–100)</h2>
            <p className="text-slate-500 leading-relaxed">
              Measures how much public information is available about this candidate. Composed of four
              equally weighted components: voting record availability (0–40), campaign finance disclosure
              completeness (0–30), public statements on record (0–30), and legal history disclosure
              (0–10, where applicable). A score of 100 means all components have complete public data
              with verified source links.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-900 mb-2">Sentiment Score</h2>
            <p className="text-slate-500 leading-relaxed">
              News and public coverage sentiment, broken down by outlet type (conservative, liberal, neutral).
              Sentiment is analyzed using the{" "}
              <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">cardiffnlp/twitter-roberta-base-sentiment-latest</code>{" "}
              model on articles from a documented list of outlets. A minimum of 50 articles per outlet
              category is required to display a sentiment score for that category. If coverage is
              insufficient, "Insufficient coverage data" is shown rather than a potentially misleading score.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-900 mb-2">Factual Consistency Score (0–100)</h2>
            <p className="text-slate-500 leading-relaxed">
              Measures how well stated positions align with voting record and documented actions.
              For candidates with fewer than 10 documented votes (first-time candidates, short tenure),
              this score is computed from a proxy formula: attendance rate (0–40) + regulatory
              compliance record (0–30) + documented position statements (0–30). A "Limited Data"
              indicator is shown when the proxy is used. As voting record depth grows, the score
              transitions to direct position-to-vote comparison.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-900 mb-2">Campaign Finance Score (0–100)</h2>
            <p className="text-slate-500 leading-relaxed">
              Evaluates donor composition, spending patterns, and disclosure completeness. Higher scores
              reflect greater transparency in filings and a broader individual donor base relative to
              PAC and party transfer contributions. All data sourced from the FEC (federal candidates)
              or state campaign finance disclosure systems.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-slate-900 mb-2">Government Data Accessibility Score (0–100)</h2>
            <p className="text-slate-500 leading-relaxed">
              Scores each state and local government on how well it publishes candidate and election
              data in machine-readable, publicly accessible formats. Criteria: Is filing data public?
              Is it machine-readable? Is it accessible without authentication or fees? Is it timely?
              Are voting records available? Is campaign finance data detailed? Does the jurisdiction's
              robots.txt block programmatic access to public election data? Jurisdictions that publish
              no data at all score near 0. Scores are benchmarked per election cycle.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
