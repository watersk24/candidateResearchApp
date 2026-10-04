import Link from "next/link";
import Nav from "@/components/Nav";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Search Candidates — Candidate Research" };

function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  withdrawn: "Withdrawn",
  elected: "Elected",
  defeated: "Defeated",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  elected: "bg-blue-50 text-blue-700 border-blue-200",
  withdrawn: "bg-slate-100 text-slate-400 border-slate-200",
  defeated: "bg-slate-100 text-slate-500 border-slate-200",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const candidates =
    query.length >= 2
      ? await db.candidate.findMany({
          where: {
            fullName: { contains: query, mode: "insensitive" },
          },
          include: {
            election: {
              include: { district: true },
            },
            ratings: { select: { transparencyScore: true } },
          },
          orderBy: [{ status: "asc" }, { fullName: "asc" }],
          take: 30,
        })
      : [];

  return (
    <>
      <Nav initialQuery={query} />
      <main className="flex-1 mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">Search Candidates</h1>

        {/* Search form */}
        <form action="/search" method="GET" className="mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search by name..."
              autoFocus
              autoComplete="off"
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </div>
          {query.length > 0 && query.length < 2 && (
            <p className="text-xs text-slate-400 mt-2">Enter at least 2 characters.</p>
          )}
        </form>

        {/* Empty prompt */}
        {query.length < 2 && (
          <div className="text-center py-16 text-slate-400">
            <svg
              className="w-10 h-10 mx-auto mb-3 text-slate-200"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <p className="text-sm">Type a candidate&apos;s name to search across all races.</p>
          </div>
        )}

        {/* No results */}
        {query.length >= 2 && candidates.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="font-medium text-slate-600 mb-1">No candidates found</p>
            <p className="text-sm">No results for &ldquo;{query}&rdquo;. Try a different name.</p>
          </div>
        )}

        {/* Results */}
        {candidates.length > 0 && (
          <>
            <p className="text-xs text-slate-400 mb-3">
              {candidates.length === 30 ? "Showing first 30 results" : `${candidates.length} result${candidates.length === 1 ? "" : "s"}`} for &ldquo;{query}&rdquo;
            </p>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {candidates.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/candidates/${candidate.profileSlug}`}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 text-sm group-hover:text-blue-700 transition-colors">
                        {candidate.fullName}
                      </span>
                      {candidate.party && (
                        <span className="text-xs text-slate-400">({candidate.party})</span>
                      )}
                      {candidate.isIncumbent && (
                        <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                          Incumbent
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {candidate.election.name}
                      <span className="mx-1 text-slate-300">·</span>
                      {candidate.election.district.name}
                      <span className="mx-1 text-slate-300">·</span>
                      {formatDate(candidate.election.electionDate)}
                    </p>
                    {candidate.ratings?.transparencyScore != null && (
                      <p className="text-xs text-slate-400 mt-1">
                        Transparency: <span className="text-slate-600 font-medium">{candidate.ratings.transparencyScore}</span>
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={`text-xs border rounded-full px-2 py-0.5 ${STATUS_COLORS[candidate.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}
                    >
                      {STATUS_LABELS[candidate.status] ?? candidate.status}
                    </span>
                    <svg
                      className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
