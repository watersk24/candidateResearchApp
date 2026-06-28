"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type CandidateOption = {
  profileSlug: string;
  fullName: string;
  party: string | null;
  election: { district: { name: string } };
};

type CandidateA = {
  profileSlug: string;
  fullName: string;
  party: string | null;
  status: string;
  election: {
    status: string;
    district: { name: string };
  };
};

type Props = {
  candidateA: CandidateA;
  allCandidates: CandidateOption[];
  sameRaceSlugs: string[];
  slugA: string;
};

export default function CandidateSelector({
  candidateA,
  allCandidates,
  sameRaceSlugs,
  slugA,
}: Props) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const sameRaceCandidates = allCandidates.filter((c) =>
    sameRaceSlugs.includes(c.profileSlug)
  );

  const searchResults =
    query.trim().length >= 2
      ? allCandidates.filter(
          (c) =>
            c.profileSlug !== slugA &&
            c.fullName.toLowerCase().includes(query.toLowerCase())
        )
      : [];

  function select(slugB: string) {
    router.push(`/compare?a=${slugA}&b=${slugB}`);
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-6">
        {/* Back */}
        <Link
          href={`/candidates/${slugA}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to {candidateA.fullName}
        </Link>

        <h1 className="text-xl font-semibold text-slate-900 mb-1">Compare candidates</h1>
        <p className="text-sm text-slate-500 mb-6">Select a second candidate to compare side by side.</p>

        {/* Candidate A summary */}
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-2">
            Comparing from
          </p>
          <div className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
            <p className="font-medium text-slate-900">
              {candidateA.fullName}
              {candidateA.party && (
                <span className="text-slate-400 font-normal"> ({candidateA.party})</span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{candidateA.election.district.name}</p>
          </div>
        </div>

        {/* Same-race quick select */}
        {sameRaceCandidates.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-3">
              Same race
            </p>
            <div className="space-y-2">
              {sameRaceCandidates.map((c) => (
                <button
                  key={c.profileSlug}
                  onClick={() => select(c.profileSlug)}
                  className="w-full text-left border border-slate-200 rounded-xl px-4 py-3 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
                >
                  <p className="font-medium text-slate-900 group-hover:text-blue-800 text-sm">
                    {c.fullName}
                    {c.party && (
                      <span className="text-slate-400 font-normal"> ({c.party})</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{c.election.district.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search any candidate */}
        <div>
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-3">
            Search any candidate
          </p>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a name..."
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {query.trim().length >= 2 && (
            <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
              {searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-400">No candidates found.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {searchResults.map((c) => (
                    <button
                      key={c.profileSlug}
                      onClick={() => select(c.profileSlug)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors group"
                    >
                      <p className="font-medium text-slate-900 group-hover:text-blue-700 text-sm">
                        {c.fullName}
                        {c.party && (
                          <span className="text-slate-400 font-normal"> ({c.party})</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.election.district.name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
