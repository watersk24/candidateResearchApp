"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Bias = "conservative" | "liberal" | "neutral";
type RatingKey = "transparency" | "sentiment" | "factual" | "finance";
type Side = "a" | "b";

type CandidateOption = {
  profileSlug: string;
  fullName: string;
  party: string | null;
  election: { district: { name: string } };
};

type VotingRecord = {
  id: string;
  billOrMeasure: string;
  vote: string;
  voteDate: string;
  sourceUrl: string;
  sourceAvailable: boolean;
};

type CampaignFinanceRecord = {
  id: string;
  filingPeriod: string;
  totalRaised: string | null;
  individualDonorPct: string | null;
  pacDonorPct: string | null;
  totalSpent: string | null;
  filingComplete: boolean;
  sourceUrl: string;
  sourceAvailable: boolean;
};

type LegalEntry = {
  id: string;
  caseType: string;
  caseDate: string;
  jurisdiction: string;
  outcome: string | null;
};

type BusinessAffiliation = {
  id: string;
  entityName: string;
  role: string;
  stateOfRegistration: string;
};

type Ratings = {
  transparencyScore: number | null;
  sentimentConservative: number | null;
  sentimentLiberal: number | null;
  sentimentNeutral: number | null;
  factualConsistencyScore: number | null;
  campaignFinanceScore: number | null;
  dataStatus: "current" | "stale" | "limited";
};

type Candidate = {
  fullName: string;
  party: string | null;
  status: string;
  isIncumbent: boolean;
  profileSlug: string;
  hasLimitedData: boolean;
  votingRecords: VotingRecord[];
  campaignFinanceRecords: CampaignFinanceRecord[];
  legalHistory: LegalEntry[];
  businessAffiliations: BusinessAffiliation[];
  newsArticles: { outlet: { bias: Bias } }[];
  ratings: Ratings | null;
  election: {
    name: string;
    status: string;
    district: { name: string; level: string };
  };
};

type Props = {
  candidateA: Candidate;
  candidateB: Candidate;
  allCandidates: CandidateOption[];
  slugA: string;
  slugB: string;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComparisonView({
  candidateA,
  candidateB,
  allCandidates,
  slugA,
  slugB,
}: Props) {
  const [popup, setPopup] = useState<{ side: Side; type: RatingKey } | null>(null);
  const router = useRouter();

  const candidates = { a: candidateA, b: candidateB };

  function changeCandidate(side: Side, newSlug: string) {
    const otherSlug = side === "a" ? slugB : slugA;
    if (side === "a") {
      router.push(`/compare?a=${newSlug}&b=${otherSlug}`);
    } else {
      router.push(`/compare?a=${otherSlug}&b=${newSlug}`);
    }
  }

  function articleCount(candidate: Candidate, bias: Bias) {
    return candidate.newsArticles.filter((a) => a.outlet.bias === bias).length;
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6">

        {/* Page header */}
        <div className="mb-6">
          <Link
            href={`/candidates/${slugA}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to {candidateA.fullName}
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Comparing candidates</h1>
        </div>

        {/* Scrollable comparison grid */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[600px] px-4 sm:px-0">

            {/* Column selectors */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(["a", "b"] as Side[]).map((side) => (
                <div key={side}>
                  <label className="text-xs text-slate-400 mb-1 block">
                    {side === "a" ? "Candidate A" : "Candidate B"}
                  </label>
                  <select
                    value={side === "a" ? slugA : slugB}
                    onChange={(e) => changeCandidate(side, e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {allCandidates.map((c) => (
                      <option key={c.profileSlug} value={c.profileSlug}>
                        {c.fullName}{c.party ? ` (${c.party})` : ""} — {c.election.district.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* ── Candidate headers ── */}
            <div className="grid grid-cols-2 gap-0 border border-slate-200 rounded-xl overflow-hidden mb-4">
              {(["a", "b"] as Side[]).map((side, i) => {
                const c = candidates[side];
                return (
                  <div
                    key={side}
                    className={`px-4 py-4 bg-white ${i === 0 ? "border-r border-slate-200" : ""}`}
                  >
                    <Link
                      href={`/candidates/${c.profileSlug}`}
                      className="font-semibold text-slate-900 hover:text-blue-700 transition-colors"
                    >
                      {c.fullName}
                    </Link>
                    {c.party && (
                      <span className="text-slate-400 font-normal text-sm"> ({c.party})</span>
                    )}
                    <p className="text-xs text-slate-500 mt-0.5">{c.election.district.name}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {c.isIncumbent && (
                        <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">Incumbent</span>
                      )}
                      <ElectionStatusBadge status={c.election.status} />
                      {c.hasLimitedData && (
                        <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full px-2 py-0.5">Limited data</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Ratings ── */}
            <CompareSection title="Ratings">
              {(["transparency", "factual", "finance"] as RatingKey[]).map((ratingType) => {
                const labels: Record<string, string> = {
                  transparency: "Transparency",
                  factual: "Factual Consistency",
                  finance: "Campaign Finance",
                };
                return (
                  <CompareRow key={ratingType} label={labels[ratingType]}>
                    {(["a", "b"] as Side[]).map((side) => {
                      const c = candidates[side];
                      const score =
                        ratingType === "transparency"
                          ? c.ratings?.transparencyScore
                          : ratingType === "factual"
                          ? c.ratings?.factualConsistencyScore
                          : c.ratings?.campaignFinanceScore;
                      return (
                        <div key={side} className="flex items-center gap-2">
                          {score != null ? (
                            <span className="text-xl font-bold text-slate-900">
                              {score}
                              <span className="text-xs font-normal text-slate-400 ml-0.5">/ 100</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {c.ratings?.dataStatus === "limited" ? "Limited data" : "No data"}
                            </span>
                          )}
                          <button
                            onClick={() => setPopup({ side, type: ratingType })}
                            aria-label={`Open ${labels[ratingType]} explanation for ${c.fullName}`}
                            className="text-slate-300 hover:text-slate-500 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="10" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </CompareRow>
                );
              })}
            </CompareSection>

            {/* ── Sentiment ── */}
            <CompareSection title="Sentiment">
              {(["conservative", "liberal", "neutral"] as Bias[]).map((bias) => (
                <CompareRow key={bias} label={`${bias.charAt(0).toUpperCase() + bias.slice(1)} outlets`}>
                  {(["a", "b"] as Side[]).map((side) => {
                    const c = candidates[side];
                    const count = articleCount(c, bias);
                    const score =
                      bias === "conservative"
                        ? c.ratings?.sentimentConservative
                        : bias === "liberal"
                        ? c.ratings?.sentimentLiberal
                        : c.ratings?.sentimentNeutral;
                    return (
                      <div key={side}>
                        {count < 50 ? (
                          <span className="text-xs text-slate-400">
                            Insufficient
                            {count > 0 && ` (${count})`}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <SentimentLabel score={score ?? null} />
                            <span className="text-xs text-slate-400">({count})</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CompareRow>
              ))}
            </CompareSection>

            {/* ── Voting Record ── */}
            <CompareSection title="Voting Record (recent)">
              <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
                {(["a", "b"] as Side[]).map((side) => {
                  const c = candidates[side];
                  return (
                    <div key={side} className="px-4 py-3">
                      {c.votingRecords.length === 0 ? (
                        <p className="text-xs text-slate-400">
                          {c.isIncumbent ? "No records available." : "No prior office held."}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {c.votingRecords.map((v) => (
                            <div key={v.id} className="flex items-start justify-between gap-2">
                              <span className="text-xs text-slate-700 leading-tight">{v.billOrMeasure}</span>
                              <VoteBadge vote={v.vote} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CompareSection>

            {/* ── Campaign Finance ── */}
            <CompareSection title="Campaign Finance">
              <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
                {(["a", "b"] as Side[]).map((side) => {
                  const c = candidates[side];
                  const f = c.campaignFinanceRecords[0] ?? null;
                  return (
                    <div key={side} className="px-4 py-3">
                      {!f ? (
                        <p className="text-xs text-slate-400">No records available.</p>
                      ) : (
                        <div className="space-y-1.5 text-xs">
                          <FinanceLine label="Raised" value={f.totalRaised ? formatCurrency(f.totalRaised) : "—"} />
                          <FinanceLine label="Individuals" value={f.individualDonorPct != null ? `${parseFloat(f.individualDonorPct).toFixed(1)}%` : "—"} />
                          <FinanceLine label="PACs" value={f.pacDonorPct != null ? `${parseFloat(f.pacDonorPct).toFixed(1)}%` : "—"} />
                          <FinanceLine label="Spent" value={f.totalSpent ? formatCurrency(f.totalSpent) : "—"} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CompareSection>

            {/* ── Legal History ── */}
            <CompareSection title="Legal History">
              <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
                {(["a", "b"] as Side[]).map((side) => {
                  const c = candidates[side];
                  return (
                    <div key={side} className="px-4 py-3">
                      {c.legalHistory.length === 0 ? (
                        <p className="text-xs text-slate-400">None found in public records.</p>
                      ) : (
                        <div className="space-y-2">
                          {c.legalHistory.map((e) => (
                            <div key={e.id}>
                              <p className="text-xs font-medium text-slate-700 capitalize">{e.caseType}</p>
                              <p className="text-xs text-slate-400">{e.jurisdiction} · {formatDate(e.caseDate)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CompareSection>

            {/* ── Business Affiliations ── */}
            <CompareSection title="Business Affiliations">
              <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
                {(["a", "b"] as Side[]).map((side) => {
                  const c = candidates[side];
                  return (
                    <div key={side} className="px-4 py-3">
                      {c.businessAffiliations.length === 0 ? (
                        <p className="text-xs text-slate-400">None found in public records.</p>
                      ) : (
                        <div className="space-y-2">
                          {c.businessAffiliations.map((a) => (
                            <div key={a.id}>
                              <p className="text-xs font-medium text-slate-700">{a.entityName}</p>
                              <p className="text-xs text-slate-400">{a.role} · {a.stateOfRegistration}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CompareSection>

            {/* Footer */}
            <p className="text-xs text-slate-400 mt-6 pb-8">
              All data sourced from government and public records.{" "}
              <Link href="/methodology" className="hover:underline">Ratings methodology</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Rating popup */}
      {popup && (
        <RatingPopup
          side={popup.side}
          type={popup.type}
          candidate={candidates[popup.side]}
          onClose={() => setPopup(null)}
        />
      )}
    </main>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

function CompareSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">{title}</span>
      </div>
      {children}
    </div>
  );
}

function CompareRow({ label, children }: { label: string; children: ReactNode }) {
  const cols = Array.isArray(children) ? children : [children];
  return (
    <div className="grid border-b border-slate-100 last:border-0" style={{ gridTemplateColumns: "120px 1fr 1fr" }}>
      <div className="px-4 py-3 text-xs text-slate-500 self-center">{label}</div>
      {cols.map((col, i) => (
        <div key={i} className={`px-4 py-3 ${i === 0 ? "border-l border-slate-100" : "border-l border-slate-100"}`}>
          {col}
        </div>
      ))}
    </div>
  );
}

function FinanceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

// ─── Badges & labels ──────────────────────────────────────────────────────────

function ElectionStatusBadge({ status }: { status: string }) {
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
    <span className={`text-xs border rounded-full px-2 py-0.5 ${styles[status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function VoteBadge({ vote }: { vote: string }) {
  const styles: Record<string, string> = {
    yea: "bg-green-50 text-green-700",
    nay: "bg-red-50 text-red-700",
    abstain: "bg-slate-100 text-slate-500",
    absent: "bg-slate-100 text-slate-400",
    present: "bg-blue-50 text-blue-600",
  };
  const labels: Record<string, string> = { yea: "Yea", nay: "Nay", abstain: "Abstain", absent: "Absent", present: "Present" };
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${styles[vote] ?? "bg-slate-100 text-slate-500"}`}>
      {labels[vote] ?? vote}
    </span>
  );
}

function SentimentLabel({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs text-slate-400">No data</span>;
  if (score >= 0.6) return <span className="text-xs font-medium text-green-700">Positive</span>;
  if (score <= 0.4) return <span className="text-xs font-medium text-red-600">Negative</span>;
  return <span className="text-xs font-medium text-slate-600">Neutral</span>;
}

// ─── Rating popup ─────────────────────────────────────────────────────────────

function RatingPopup({
  side,
  type,
  candidate,
  onClose,
}: {
  side: Side;
  type: RatingKey;
  candidate: Candidate;
  onClose: () => void;
}) {
  const ratings = candidate.ratings;
  const titles: Record<RatingKey, string> = {
    transparency: "Transparency Score",
    sentiment: "Sentiment Score",
    factual: "Factual Consistency Score",
    finance: "Campaign Finance Score",
  };
  const score =
    type === "transparency"
      ? ratings?.transparencyScore
      : type === "factual"
      ? ratings?.factualConsistencyScore
      : ratings?.campaignFinanceScore;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">{titles[type]}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{candidate.fullName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-sm space-y-3">
          {type !== "sentiment" && (
            score != null ? (
              <p className="text-3xl font-bold text-slate-900">
                {score}
                <span className="text-base font-normal text-slate-400 ml-1">/ 100</span>
              </p>
            ) : (
              <p className="text-slate-500 text-sm">
                {type === "factual" && candidate.votingRecords.length < 10
                  ? "Fewer than 10 recorded votes — score requires a minimum of 10."
                  : "Insufficient data to calculate this score."}
              </p>
            )
          )}

          {type === "transparency" && score != null && (
            <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
              {[["Profile data completeness", "0–40 pts"], ["Finance filing compliance", "0–30 pts"], ["Public record depth", "0–20 pts"], ["Data currency", "0–10 pts"]].map(([label, pts]) => (
                <div key={label} className="flex justify-between px-3 py-2 text-xs">
                  <span className="text-slate-700">{label}</span>
                  <span className="text-slate-400">{pts}</span>
                </div>
              ))}
            </div>
          )}

          {type === "sentiment" && (
            <>
              <p className="text-xs text-slate-600">Minimum 50 articles per outlet type required.</p>
              <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
                {(["conservative", "liberal", "neutral"] as Bias[]).map((bias) => {
                  const count = candidate.newsArticles.filter((a) => a.outlet.bias === bias).length;
                  return (
                    <div key={bias} className="flex justify-between px-3 py-2 text-xs">
                      <span className="capitalize text-slate-700">{bias} outlets</span>
                      <span className="text-slate-400">
                        {count < 50 ? `Insufficient (${count})` : `${count} articles`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <Link href="/methodology" onClick={onClose} className="block mt-5 text-xs text-blue-600 hover:underline">
          Read full methodology →
        </Link>
      </div>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
}
