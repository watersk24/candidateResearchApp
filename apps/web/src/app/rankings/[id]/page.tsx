import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jurisdiction = await db.jurisdiction.findUnique({ where: { id } });
  if (!jurisdiction) return { title: "Not Found" };
  return { title: `${jurisdiction.name} Data Accessibility — Candidate Research` };
}

const CRITERIA: Array<{
  key: keyof ScoreFields;
  label: string;
  description: string;
  highIsBetter?: boolean;
}> = [
  {
    key: "filingPublic",
    label: "Filings are publicly available",
    description: "Candidate filings and disclosures are published online without requiring a public records request.",
  },
  {
    key: "machineReadable",
    label: "Machine-readable format",
    description: "Data is available as CSV, JSON, or a structured API — not only as PDFs or HTML tables.",
  },
  {
    key: "noAuthRequired",
    label: "No account required",
    description: "Voters can access the data without registering, logging in, or providing personal information.",
  },
  {
    key: "timely",
    label: "Updated in a timely manner",
    description: "Data is updated within 48 hours of new filings. Stale data impedes voters researching active campaigns.",
  },
  {
    key: "votingRecordsAvailable",
    label: "Voting records available",
    description: "Individual legislator voting records or meeting minutes are published in a searchable format.",
  },
  {
    key: "financeDetailed",
    label: "Detailed campaign finance",
    description: "Campaign finance data includes itemized contributions and expenditures, not just summary totals.",
  },
  {
    key: "robotsTxtBlocks",
    label: "robots.txt blocks automated access",
    description: "The government portal's robots.txt disallows automated crawling, which limits civic data tools.",
    highIsBetter: false,
  },
];

type ScoreFields = {
  filingPublic: boolean;
  machineReadable: boolean;
  noAuthRequired: boolean;
  timely: boolean;
  votingRecordsAvailable: boolean;
  financeDetailed: boolean;
  robotsTxtBlocks: boolean;
  hasNoDataAtAll: boolean;
};

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-700";
  if (score >= 50) return "text-amber-600";
  if (score >= 25) return "text-orange-600";
  return "text-red-600";
}

function scoreBarColor(score: number): string {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-amber-400";
  if (score >= 25) return "bg-orange-400";
  return "bg-red-500";
}

function scoreBadge(score: number): string {
  if (score >= 75) return "A";
  if (score >= 50) return "B";
  if (score >= 25) return "C";
  return "D";
}

const LOCAL_TYPES = new Set(["county", "city", "school_district", "municipality"]);

export default async function AccessibilityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [score, jurisdiction] = await Promise.all([
    db.dataAccessibilityScore.findFirst({
      where: { jurisdictionId: id, electionCycle: "2026" },
    }),
    db.jurisdiction.findUnique({
      where: { id },
      include: { parent: true },
    }),
  ]);

  if (!jurisdiction) notFound();

  const isLocal = LOCAL_TYPES.has(jurisdiction.type);
  const backHref = isLocal ? "/rankings/local" : "/rankings";
  const backLabel = isLocal ? "Local Rankings" : "State Rankings";

  return (
    <>
      <Nav />
      <main className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 flex-wrap">
          <Link href="/rankings" className="hover:text-slate-800">State Rankings</Link>
          {isLocal && (
            <>
              <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              <Link href="/rankings/local" className="hover:text-slate-800">Local Government</Link>
            </>
          )}
          <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-slate-800 font-medium">{jurisdiction.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-slate-900">{jurisdiction.name}</h1>
              {jurisdiction.parent && (
                <p className="text-sm text-slate-500 mt-0.5">{jurisdiction.parent.name}</p>
              )}
            </div>
            {score && (
              <div className="shrink-0 text-center">
                <div className={`text-5xl font-bold tabular-nums ${scoreColor(score.overallScore)}`}>
                  {score.overallScore}
                </div>
                <div className={`text-sm font-semibold mt-0.5 ${scoreColor(score.overallScore)}`}>
                  Grade {scoreBadge(score.overallScore)}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">out of 100</div>
              </div>
            )}
          </div>

          {score && (
            <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreBarColor(score.overallScore)}`}
                style={{ width: `${score.overallScore}%` }}
              />
            </div>
          )}
        </div>

        {!score ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-8">
            <p className="text-sm font-medium text-amber-800 mb-1">No accessibility data yet</p>
            <p className="text-sm text-amber-700">
              We haven&apos;t run an accessibility check for {jurisdiction.name} yet.
              Scores are computed from automated checks against official government data portals.
            </p>
          </div>
        ) : score.hasNoDataAtAll ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-8">
            <p className="text-sm font-medium text-red-800 mb-1">No public data found</p>
            <p className="text-sm text-red-700">
              We were unable to locate any publicly accessible candidate or election data for {jurisdiction.name}.
            </p>
          </div>
        ) : null}

        {/* Criteria breakdown */}
        {score && !score.hasNoDataAtAll && (
          <section className="mb-8">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Criteria Breakdown</h2>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {CRITERIA.map((criterion) => {
                const value = score[criterion.key as keyof typeof score] as boolean;
                const passes = criterion.highIsBetter === false ? !value : value;
                return (
                  <div key={criterion.key} className="px-5 py-4 flex items-start gap-4">
                    <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${passes ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {passes ? "✓" : "✗"}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${passes ? "text-slate-900" : "text-slate-600"}`}>
                        {criterion.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {criterion.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Contact officials */}
        <section className="mb-8">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Contact Election Officials</h2>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
            {jurisdiction.electionOfficialsUrl ? (
              <div className="px-5 py-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-800">Election office website</p>
                  <a
                    href={jurisdiction.electionOfficialsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all mt-0.5 block"
                  >
                    {jurisdiction.electionOfficialsUrl}
                  </a>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 text-sm text-slate-400">Election office website not on record.</div>
            )}

            {jurisdiction.electionOfficialsContactUrl ? (
              <div className="px-5 py-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-800">Contact page</p>
                  <a
                    href={jurisdiction.electionOfficialsContactUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline break-all mt-0.5 block"
                  >
                    {jurisdiction.electionOfficialsContactUrl}
                  </a>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 text-sm text-slate-400">Contact page not on record.</div>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            If data for {jurisdiction.name} is incomplete or inaccessible, you can contact the
            election office directly to request public records or advocate for improved data access.
          </p>
        </section>

        {/* Back link */}
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to {backLabel}
        </Link>
      </main>
    </>
  );
}
