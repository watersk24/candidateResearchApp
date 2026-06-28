"use client";

import { useState } from "react";
import Link from "next/link";
import type { Election, ResolvedDistrict } from "./HomeFlow";

type Props = {
  locationLabel: string;
  districts: ResolvedDistrict[];
  elections: Election[];
  onRefineLocation: () => void;
};

type Level = "federal" | "state" | "local";
const LEVELS: Level[] = ["federal", "state", "local"];
const LEVEL_LABELS: Record<Level, string> = {
  federal: "Federal",
  state: "State",
  local: "Local",
};

export default function Dashboard({ locationLabel, districts, elections, onRefineLocation }: Props) {
  const [collapsed, setCollapsed] = useState<Record<Level, boolean>>({
    federal: false,
    state: false,
    local: false,
  });
  const [panelOpen, setPanelOpen] = useState(false);

  function toggleLevel(level: Level) {
    setCollapsed((prev) => ({ ...prev, [level]: !prev[level] }));
  }

  const districtsByLevel: Record<Level, ResolvedDistrict[]> = {
    federal: districts.filter((d) => d.level === "federal"),
    state: districts.filter((d) => d.level === "state"),
    local: districts.filter((d) => d.level === "local"),
  };

  const byLevel = Object.fromEntries(
    LEVELS.map((level) => [
      level,
      elections.filter((e) => e.district.level === level),
    ])
  ) as Record<Level, Election[]>;

  const hasAnyRaces = elections.length > 0;

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        {/* Location header */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-slate-900">
              Your Races
              {locationLabel && (
                <span className="text-slate-500 font-normal"> — {locationLabel}</span>
              )}
            </h1>
            <button
              onClick={onRefineLocation}
              className="text-xs text-blue-600 hover:underline"
            >
              Refine location
            </button>
          </div>

          {districts.length > 0 && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-1.5">
                {districts.slice(0, 8).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setPanelOpen((v) => !v)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full px-2.5 py-0.5 transition-colors"
                  >
                    {d.name}
                  </button>
                ))}
                {districts.length > 8 && (
                  <button
                    onClick={() => setPanelOpen((v) => !v)}
                    className="text-xs text-blue-600 hover:underline px-1 py-0.5"
                  >
                    +{districts.length - 8} more
                  </button>
                )}
              </div>

              {panelOpen && (
                <div className="mt-3 border border-slate-200 rounded-xl bg-white overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <h2 className="text-sm font-semibold text-slate-800">Your Districts</h2>
                    <button
                      onClick={() => setPanelOpen(false)}
                      aria-label="Close district panel"
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="px-4 py-3 space-y-4">
                    {(["federal", "state", "local"] as Level[]).map((level) => {
                      const levelDistricts = districtsByLevel[level];
                      if (levelDistricts.length === 0) return null;
                      return (
                        <div key={level}>
                          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-1.5">
                            {level}
                          </p>
                          <ul className="space-y-1">
                            {levelDistricts.map((d) => (
                              <li key={d.id} className="text-sm text-slate-700">
                                {d.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-start gap-2">
                    <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    <p className="text-xs text-slate-500">
                      These districts were resolved from your location. If something looks wrong,{" "}
                      <button
                        onClick={() => { setPanelOpen(false); onRefineLocation(); }}
                        className="text-blue-600 hover:underline"
                      >
                        refine your location
                      </button>{" "}
                      for a more precise match.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Empty state */}
        {!hasAnyRaces && (
          <div className="text-center py-16 text-slate-500">
            <p className="font-medium text-slate-700 mb-1">No active races found</p>
            <p className="text-sm">
              No upcoming or active elections were found for your location.{" "}
              <button onClick={onRefineLocation} className="text-blue-600 hover:underline">
                Try a different location.
              </button>
            </p>
          </div>
        )}

        {/* Races by level */}
        {hasAnyRaces && (
          <div className="space-y-8">
            {LEVELS.map((level) => {
              const levelElections = byLevel[level];
              if (levelElections.length === 0) return null;

              return (
                <section key={level}>
                  <button
                    onClick={() => toggleLevel(level)}
                    className="flex items-center gap-2 mb-3 group w-full text-left"
                  >
                    <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
                      {LEVEL_LABELS[level]}
                    </span>
                    <span className="text-xs text-slate-300 group-hover:text-slate-400 transition-colors">
                      {collapsed[level] ? "▶" : "▼"}
                    </span>
                  </button>

                  {!collapsed[level] && (
                    <div className="space-y-3">
                      {levelElections.map((election) => (
                        <ElectionCard key={election.id} election={election} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-slate-400 mt-12 pb-8">
          Data refreshed daily. All data sourced from government and public records.
        </p>
      </div>
    </main>
  );
}

function ElectionCard({ election }: { election: Election }) {
  const activeCandidates = election.candidates.filter((c) => c.status !== "withdrawn");
  const hasLimitedData = election.candidates.some((c) => c.hasLimitedData);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-slate-900 text-sm">{election.name}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {election.electionType.charAt(0).toUpperCase() + election.electionType.slice(1)} ·{" "}
            {formatDate(election.electionDate)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasLimitedData && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
              Limited data
            </span>
          )}
          <StatusBadge status={election.status} />
        </div>
      </div>

      {activeCandidates.length === 0 ? (
        <div className="px-5 py-3 text-sm text-slate-400">No candidates filed</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {activeCandidates.map((candidate) => (
            <li key={candidate.id}>
              <Link
                href={`/candidates/${candidate.profileSlug}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-sm text-slate-900 group-hover:text-blue-700 transition-colors font-medium">
                    {candidate.fullName}
                  </span>
                  {candidate.party && (
                    <span className="text-xs text-slate-400">({candidate.party})</span>
                  )}
                  {candidate.status === "elected" && (
                    <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
                      Elected
                    </span>
                  )}
                </div>
                <svg
                  className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </li>
          ))}
          {election.candidates.filter((c) => c.status === "withdrawn").map((candidate) => (
            <li key={candidate.id} className="px-5 py-3 flex items-center gap-2.5">
              <span className="text-sm text-slate-400 line-through">{candidate.fullName}</span>
              {candidate.party && (
                <span className="text-xs text-slate-300">({candidate.party})</span>
              )}
              <span className="text-xs text-slate-400">Withdrawn</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    upcoming: "bg-blue-50 text-blue-700 border-blue-200",
    concluded: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const labels: Record<string, string> = {
    active: "Active",
    upcoming: "Upcoming",
    concluded: "Concluded",
  };

  return (
    <span
      className={`text-xs border rounded-full px-2 py-0.5 ${styles[status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
