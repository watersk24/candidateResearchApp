import Link from "next/link";
import Nav from "@/components/Nav";
import { db } from "@/lib/db";

export const metadata = { title: "Local Government Accessibility Rankings — Candidate Research" };

export const dynamic = "force-dynamic";

const LOCAL_TYPES = ["county", "city", "school_district", "special_district"] as const;

const TYPE_LABELS: Record<string, string> = {
  county: "County",
  city: "City",
  school_district: "School District",
  special_district: "Special District",
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

function Check({ value }: { value: boolean }) {
  return value ? (
    <span className="text-green-600 font-bold">✓</span>
  ) : (
    <span className="text-red-400">✗</span>
  );
}

export default async function LocalRankingsPage() {
  const allScores = await db.dataAccessibilityScore.findMany({
    where: { electionCycle: "2026" },
    include: { jurisdiction: { include: { parent: true } } },
    orderBy: { overallScore: "desc" },
  });

  const scores = allScores.filter((s) =>
    (LOCAL_TYPES as readonly string[]).includes(s.jurisdiction.type)
  );

  return (
    <>
      <Nav />
      <main className="flex-1 mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/rankings" className="hover:text-slate-800">State Rankings</Link>
          <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-slate-800 font-medium">Local Government</span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Local Government Accessibility Rankings</h1>
          <p className="text-slate-500 text-sm mt-1 max-w-prose">
            County, city, and school district governments scored on how accessible their candidate
            and election data is to the public.
          </p>
        </div>

        {scores.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="font-medium text-slate-600 mb-1">No local scores yet</p>
            <p className="text-sm">Rankings will appear once the data pipeline has run.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[2rem_1fr_7rem_repeat(6,2.5rem)] gap-x-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <span>#</span>
              <span>Jurisdiction</span>
              <span>Score</span>
              <span title="Data filed publicly">Filed</span>
              <span title="Machine-readable format">CSV/API</span>
              <span title="No account required">Open</span>
              <span title="Updated on time">Timely</span>
              <span title="Voting records available">Votes</span>
              <span title="Detailed campaign finance">Finance</span>
            </div>

            <ul className="divide-y divide-slate-100">
              {scores.map((s, idx) => (
                <li key={s.id}>
                  <Link
                    href={`/rankings/${s.jurisdiction.id}`}
                    className="grid grid-cols-[2rem_1fr] md:grid-cols-[2rem_1fr_7rem_repeat(6,2.5rem)] gap-x-3 px-5 py-3.5 hover:bg-slate-50 transition-colors items-center"
                  >
                    <span className="text-sm text-slate-400 tabular-nums">{idx + 1}</span>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 text-sm">{s.jurisdiction.name}</span>
                        <span className="text-xs text-slate-400">
                          {TYPE_LABELS[s.jurisdiction.type] ?? s.jurisdiction.type}
                          {s.jurisdiction.parent && ` · ${s.jurisdiction.parent.name}`}
                        </span>
                      </div>
                      {/* Mobile score bar */}
                      <div className="md:hidden mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${scoreBarColor(s.overallScore)}`}
                            style={{ width: `${s.overallScore}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${scoreColor(s.overallScore)}`}>
                          {s.overallScore}
                        </span>
                      </div>
                    </div>

                    {/* Desktop score */}
                    <div className="hidden md:flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreBarColor(s.overallScore)}`}
                          style={{ width: `${s.overallScore}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold tabular-nums w-6 text-right ${scoreColor(s.overallScore)}`}>
                        {s.overallScore}
                      </span>
                      <span className={`text-xs font-bold w-4 ${scoreColor(s.overallScore)}`}>
                        {scoreBadge(s.overallScore)}
                      </span>
                    </div>

                    <span className="hidden md:block text-center text-sm"><Check value={s.filingPublic} /></span>
                    <span className="hidden md:block text-center text-sm"><Check value={s.machineReadable} /></span>
                    <span className="hidden md:block text-center text-sm"><Check value={s.noAuthRequired} /></span>
                    <span className="hidden md:block text-center text-sm"><Check value={s.timely} /></span>
                    <span className="hidden md:block text-center text-sm"><Check value={s.votingRecordsAvailable} /></span>
                    <span className="hidden md:block text-center text-sm"><Check value={s.financeDetailed} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-8">
          Scores are computed from automated checks run against official government data portals.
          Election cycle: 2026. Scores range from 0–100.
        </p>
      </main>
    </>
  );
}
