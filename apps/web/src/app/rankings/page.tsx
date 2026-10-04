import Link from "next/link";
import Nav from "@/components/Nav";
import { db } from "@/lib/db";

export const metadata = { title: "State Data Accessibility Rankings — Candidate Research" };

export const dynamic = "force-dynamic";

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

export default async function RankingsPage() {
  const allScores = await db.dataAccessibilityScore.findMany({
    where: { electionCycle: "2026" },
    include: { jurisdiction: true },
    orderBy: { overallScore: "desc" },
  });

  const scores = allScores.filter((s) => s.jurisdiction.type === "state");
  const localCount = allScores.filter((s) =>
    ["county", "city", "school_district", "special_district"].includes(s.jurisdiction.type)
  ).length;

  return (
    <>
      <Nav />
      <main className="flex-1 mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">State Data Accessibility Rankings</h1>
              <p className="text-slate-500 text-sm mt-1 max-w-prose">
                How easy is it to research candidates in each state? We score states on whether
                election and candidate data is publicly available, machine-readable, accessible
                without an account, and updated on time.
              </p>
            </div>
            {localCount > 0 && (
              <Link
                href="/rankings/local"
                className="shrink-0 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
              >
                Local rankings
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6 text-xs text-slate-500">
          {(["A ≥ 75", "B 50–74", "C 25–49", "D < 25"] as const).map((label) => {
            const [grade] = label.split(" ");
            const colors: Record<string, string> = { A: "text-green-700", B: "text-amber-600", C: "text-orange-600", D: "text-red-600" };
            return (
              <span key={label} className="flex items-center gap-1">
                <span className={`font-bold ${colors[grade]}`}>{grade}</span>
                <span>{label.slice(2)}</span>
              </span>
            );
          })}
        </div>

        {/* Table */}
        {scores.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="font-medium text-slate-600 mb-1">No state scores yet</p>
            <p className="text-sm">Rankings will appear once the data pipeline has run.</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Column headers — hidden on small screens */}
            <div className="hidden md:grid grid-cols-[2rem_1fr_7rem_repeat(6,2.5rem)] gap-x-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <span>#</span>
              <span>State</span>
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
                    {/* Rank */}
                    <span className="text-sm text-slate-400 tabular-nums">{idx + 1}</span>

                    {/* State name + mobile score */}
                    <div className="min-w-0">
                      <span className="font-medium text-slate-900 text-sm">{s.jurisdiction.name}</span>
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

                    {/* Desktop score bar + grade */}
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

                    {/* Criteria checks — desktop only */}
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
