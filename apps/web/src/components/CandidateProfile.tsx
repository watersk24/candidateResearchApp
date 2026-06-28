"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Bias = "conservative" | "liberal" | "neutral";

type NewsArticle = {
  id: string;
  outlet: { bias: Bias };
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
  partyTransferPct: string | null;
  totalSpent: string | null;
  filingComplete: boolean;
  sourceUrl: string;
  sourceAvailable: boolean;
};

type PublicStatement = {
  id: string;
  statementExcerpt: string;
  statementDate: string;
  sourceType: string;
  sourceUrl: string;
  sourceAvailable: boolean;
};

type LegalHistoryEntry = {
  id: string;
  caseType: string;
  caseDate: string;
  jurisdiction: string;
  outcome: string | null;
  sourceUrl: string;
  sourceAvailable: boolean;
};

type BusinessAffiliation = {
  id: string;
  entityName: string;
  role: string;
  stateOfRegistration: string;
  sourceUrl: string;
  sourceAvailable: boolean;
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
  status: "active" | "withdrawn" | "elected";
  isIncumbent: boolean;
  profileSlug: string;
  officialWebsiteUrl: string | null;
  lastRefreshedAt: string | null;
  dataIsStale: boolean;
  hasLimitedData: boolean;
  election: {
    name: string;
    electionType: string;
    electionDate: string;
    status: "upcoming" | "active" | "concluded";
    district: { name: string; level: string };
  };
  votingRecords: VotingRecord[];
  campaignFinanceRecords: CampaignFinanceRecord[];
  publicStatements: PublicStatement[];
  legalHistory: LegalHistoryEntry[];
  businessAffiliations: BusinessAffiliation[];
  newsArticles: NewsArticle[];
  ratings: Ratings | null;
};

type RatingKey = "transparency" | "sentiment" | "factual" | "finance";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CandidateProfile({ candidate }: { candidate: Candidate }) {
  const [openPopup, setOpenPopup] = useState<RatingKey | null>(null);
  const [showAllVotes, setShowAllVotes] = useState(false);

  const VOTES_PREVIEW = 5;
  const ratings = candidate.ratings;
  const latestFinance = candidate.campaignFinanceRecords[0] ?? null;
  const displayedVotes = showAllVotes
    ? candidate.votingRecords
    : candidate.votingRecords.slice(0, VOTES_PREVIEW);

  const articlesByBias: Record<Bias, number> = {
    conservative: candidate.newsArticles.filter((a) => a.outlet.bias === "conservative").length,
    liberal: candidate.newsArticles.filter((a) => a.outlet.bias === "liberal").length,
    neutral: candidate.newsArticles.filter((a) => a.outlet.bias === "neutral").length,
  };

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6">

        {/* Back + Compare */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to Dashboard
          </Link>
          <Link
            href={`/compare?a=${candidate.profileSlug}`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Compare →
          </Link>
        </div>

        {/* Banners */}
        {candidate.status === "withdrawn" && (
          <Banner variant="info">
            This candidate has withdrawn from the race. Profile data is retained for reference.
          </Banner>
        )}
        {candidate.dataIsStale && (
          <Banner variant="warning">
            <strong>Data refresh overdue.</strong> Information shown may not reflect recent changes.
            {candidate.lastRefreshedAt && (
              <> Last refreshed: {formatDateTime(candidate.lastRefreshedAt)}.</>
            )}
          </Banner>
        )}
        {candidate.hasLimitedData && (
          <Banner variant="caution">
            <strong>Limited Data Available.</strong> Some sections are incomplete because sufficient
            public records could not be found for this candidate.
          </Banner>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {candidate.fullName}
                {candidate.party && (
                  <span className="text-slate-400 font-normal"> ({candidate.party})</span>
                )}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {candidate.election.district.name}
                {" · "}
                <span className="capitalize">{candidate.election.electionType}</span>
                {" · "}
                {formatDate(candidate.election.electionDate)}
              </p>
              {candidate.lastRefreshedAt && !candidate.dataIsStale && (
                <p className="text-xs text-slate-400 mt-1">
                  Last refreshed: {formatDateTime(candidate.lastRefreshedAt)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {candidate.isIncumbent && (
                <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2.5 py-0.5">
                  Incumbent
                </span>
              )}
              <CandidateStatusBadge status={candidate.status} />
              <ElectionStatusBadge status={candidate.election.status} />
            </div>
          </div>

          {candidate.officialWebsiteUrl && (
            <a
              href={candidate.officialWebsiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-blue-600 hover:underline"
            >
              Candidate&apos;s Official Website{" "}
              <span className="text-slate-400">(self-promotional — not used as a factual source)</span>
            </a>
          )}
        </div>

        {/* Ratings */}
        <Section title="Ratings">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <RatingCard
              label="Transparency"
              score={ratings?.transparencyScore ?? null}
              dataStatus={ratings?.dataStatus}
              onInfo={() => setOpenPopup("transparency")}
            />
            <RatingCard
              label="Sentiment"
              score={null}
              isSentiment
              dataStatus={ratings?.dataStatus}
              onInfo={() => setOpenPopup("sentiment")}
            />
            <RatingCard
              label="Factual Consistency"
              score={ratings?.factualConsistencyScore ?? null}
              dataStatus={ratings?.dataStatus}
              onInfo={() => setOpenPopup("factual")}
            />
            <RatingCard
              label="Campaign Finance"
              score={ratings?.campaignFinanceScore ?? null}
              dataStatus={ratings?.dataStatus}
              onInfo={() => setOpenPopup("finance")}
            />
          </div>
        </Section>

        {/* Sentiment Breakdown */}
        <Section title="Sentiment Breakdown">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Outlet Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Sentiment</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-500 text-xs">Articles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(["conservative", "liberal", "neutral"] as const).map((bias) => {
                  const count = articlesByBias[bias];
                  const isInsufficient = count < 50;
                  const score =
                    bias === "conservative"
                      ? ratings?.sentimentConservative
                      : bias === "liberal"
                      ? ratings?.sentimentLiberal
                      : ratings?.sentimentNeutral;
                  return (
                    <tr key={bias}>
                      <td className="px-4 py-3 text-slate-700 capitalize">{bias} outlets</td>
                      <td className="px-4 py-3">
                        {isInsufficient ? (
                          <span className="text-slate-400 text-xs">
                            Insufficient coverage data
                            {count > 0 && ` (${count} article${count !== 1 ? "s" : ""} analyzed)`}
                          </span>
                        ) : (
                          <SentimentLabel score={score ?? null} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">{count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {Object.values(articlesByBias).every((c) => c < 50) && (
            <p className="text-xs text-slate-400 mt-2">
              Not enough news coverage to display a reliable sentiment breakdown. Minimum threshold
              is 50 articles per outlet type.
            </p>
          )}
        </Section>

        {/* Voting Record */}
        <Section title="Voting Record">
          {candidate.votingRecords.length === 0 ? (
            <EmptyState>
              No voting record available.{" "}
              {!candidate.isIncumbent
                ? "This candidate has not previously held office."
                : "No voting record data is available from public sources."}
            </EmptyState>
          ) : (
            <>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Bill / Measure</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Vote</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs hidden sm:table-cell">Date</th>
                      <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedVotes.map((record) => (
                      <tr key={record.id}>
                        <td className="px-4 py-3 text-slate-800">{record.billOrMeasure}</td>
                        <td className="px-4 py-3">
                          <VoteBadge vote={record.vote} />
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs hidden sm:table-cell">
                          {formatDate(record.voteDate)}
                        </td>
                        <td className="px-4 py-3">
                          {record.sourceAvailable ? (
                            <a
                              href={record.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Source
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">Source link unavailable</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {candidate.votingRecords.length > VOTES_PREVIEW && (
                <button
                  onClick={() => setShowAllVotes((v) => !v)}
                  className="mt-2 text-xs text-blue-600 hover:underline"
                >
                  {showAllVotes
                    ? "Show fewer"
                    : `Show all ${candidate.votingRecords.length} votes`}
                </button>
              )}
            </>
          )}
        </Section>

        {/* Campaign Finance */}
        <Section title="Campaign Finance">
          {!latestFinance ? (
            <EmptyState>
              No campaign finance records available from public sources.
            </EmptyState>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              <FinanceRow
                label="Total raised"
                value={latestFinance.totalRaised ? formatCurrency(latestFinance.totalRaised) : null}
                sourceUrl={latestFinance.sourceUrl}
                sourceAvailable={latestFinance.sourceAvailable}
              />
              <FinanceRow
                label="Individual donors"
                value={latestFinance.individualDonorPct != null ? `${parseFloat(latestFinance.individualDonorPct).toFixed(1)}%` : null}
              />
              <FinanceRow
                label="PAC donations"
                value={latestFinance.pacDonorPct != null ? `${parseFloat(latestFinance.pacDonorPct).toFixed(1)}%` : null}
              />
              <FinanceRow
                label="Party transfers"
                value={latestFinance.partyTransferPct != null ? `${parseFloat(latestFinance.partyTransferPct).toFixed(1)}%` : null}
              />
              <FinanceRow
                label="Total spent"
                value={latestFinance.totalSpent ? formatCurrency(latestFinance.totalSpent) : null}
              />
              <div className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">Filing completeness</span>
                <span className={latestFinance.filingComplete ? "text-green-700 text-xs" : "text-amber-700 text-xs"}>
                  {latestFinance.filingComplete ? "All filings current" : "Filing incomplete"}
                </span>
              </div>
            </div>
          )}
        </Section>

        {/* Public Statements */}
        <Section title="Public Statements">
          {candidate.publicStatements.length === 0 ? (
            <EmptyState>
              No public statements found in official records. Statements from campaign materials or
              candidate websites are not included — only government records and official transcripts
              are used.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {candidate.publicStatements.map((stmt) => (
                <div key={stmt.id} className="border border-slate-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-slate-800 leading-relaxed">
                    &ldquo;{stmt.statementExcerpt}&rdquo;
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-slate-400">{formatDate(stmt.statementDate)}</span>
                    <span className="text-slate-200">·</span>
                    <span className="text-xs text-slate-500 capitalize">{stmt.sourceType}</span>
                    {stmt.sourceAvailable ? (
                      <a
                        href={stmt.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Source
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">Source link unavailable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Legal History */}
        <Section title="Legal History">
          {candidate.legalHistory.length === 0 ? (
            <EmptyState>
              No legal history found in public records. This does not indicate a definitive absence
              of legal history — only that no entries were found in the public court records
              available to us.
            </EmptyState>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {candidate.legalHistory.map((entry) => (
                <div key={entry.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-800 capitalize">{entry.caseType}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {entry.jurisdiction} · {formatDate(entry.caseDate)}
                        {entry.outcome && ` · ${entry.outcome}`}
                      </p>
                    </div>
                    {entry.sourceAvailable ? (
                      <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">Source</a>
                    ) : (
                      <span className="text-xs text-slate-400 shrink-0">Source link unavailable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Business Affiliations */}
        <Section title="Business Affiliations">
          {candidate.businessAffiliations.length === 0 ? (
            <EmptyState>
              No business affiliations found in public records. This reflects the publicly available
              business registration data we were able to access.
            </EmptyState>
          ) : (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
              {candidate.businessAffiliations.map((aff) => (
                <div key={aff.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-800">{aff.entityName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{aff.role} · {aff.stateOfRegistration}</p>
                    </div>
                    {aff.sourceAvailable ? (
                      <a href={aff.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">Source</a>
                    ) : (
                      <span className="text-xs text-slate-400 shrink-0">Source link unavailable</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Footer */}
        <p className="text-xs text-slate-400 mt-8 pb-8">
          All data sourced from government and public records.{" "}
          <Link href="/methodology" className="hover:underline">
            Ratings methodology
          </Link>
        </p>
      </div>

      {/* Rating Popup */}
      {openPopup && (
        <RatingPopup
          type={openPopup}
          candidate={candidate}
          articlesByBias={articlesByBias}
          onClose={() => setOpenPopup(null)}
        />
      )}
    </main>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-lg px-4 py-4 text-sm text-slate-500 leading-relaxed">
      {children}
    </div>
  );
}

function Banner({
  variant,
  children,
}: {
  variant: "info" | "warning" | "caution";
  children: ReactNode;
}) {
  const styles = {
    info: "bg-slate-50 border-slate-200 text-slate-600",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    caution: "bg-yellow-50 border-yellow-200 text-yellow-800",
  };
  return (
    <div className={`mb-4 border rounded-lg px-4 py-3 text-sm ${styles[variant]}`}>
      {children}
    </div>
  );
}

function CandidateStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    withdrawn: "bg-slate-100 text-slate-500 border-slate-200",
    elected: "bg-blue-50 text-blue-700 border-blue-200",
  };
  const labels: Record<string, string> = {
    active: "Active",
    withdrawn: "Withdrawn",
    elected: "Elected",
  };
  return (
    <span className={`text-xs border rounded-full px-2.5 py-0.5 ${styles[status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function ElectionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    upcoming: "bg-blue-50 text-blue-700 border-blue-200",
    concluded: "bg-slate-100 text-slate-500 border-slate-200",
  };
  const labels: Record<string, string> = {
    active: "Election Active",
    upcoming: "Upcoming",
    concluded: "Concluded",
  };
  return (
    <span className={`text-xs border rounded-full px-2.5 py-0.5 ${styles[status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
      {labels[status] ?? status}
    </span>
  );
}

function RatingCard({
  label,
  score,
  isSentiment = false,
  dataStatus,
  onInfo,
}: {
  label: string;
  score: number | null;
  isSentiment?: boolean;
  dataStatus?: string;
  onInfo: () => void;
}) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white">
      <div className="flex items-start justify-between gap-1 mb-2">
        <span className="text-xs font-medium text-slate-500 leading-tight">{label}</span>
        <button
          onClick={onInfo}
          aria-label={`Open ${label} explanation`}
          className="text-slate-300 hover:text-slate-600 transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
          </svg>
        </button>
      </div>
      {isSentiment ? (
        <span className="text-sm text-slate-400">See breakdown ↓</span>
      ) : score !== null ? (
        <div className="flex items-baseline gap-0.5">
          <span className="text-2xl font-bold text-slate-900">{score}</span>
          <span className="text-xs text-slate-400 ml-0.5">/ 100</span>
        </div>
      ) : (
        <span className="text-xs text-slate-400">
          {dataStatus === "limited" ? "Limited data" : "No data"}
        </span>
      )}
    </div>
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
  const labels: Record<string, string> = {
    yea: "Yea",
    nay: "Nay",
    abstain: "Abstain",
    absent: "Absent",
    present: "Present",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles[vote] ?? "bg-slate-100 text-slate-500"}`}>
      {labels[vote] ?? vote}
    </span>
  );
}

function SentimentLabel({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-400 text-xs">No data</span>;
  if (score >= 0.6) return <span className="text-green-700 text-sm font-medium">Positive</span>;
  if (score <= 0.4) return <span className="text-red-600 text-sm font-medium">Negative</span>;
  return <span className="text-slate-600 text-sm font-medium">Neutral</span>;
}

function FinanceRow({
  label,
  value,
  sourceUrl,
  sourceAvailable,
}: {
  label: string;
  value: string | null;
  sourceUrl?: string;
  sourceAvailable?: boolean;
}) {
  return (
    <div className="px-4 py-3 flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-slate-800 font-medium">{value ?? "—"}</span>
        {sourceUrl &&
          (sourceAvailable ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
              Source
            </a>
          ) : (
            <span className="text-xs text-slate-400">Source unavailable</span>
          ))}
      </div>
    </div>
  );
}

// ─── Rating Popup ─────────────────────────────────────────────────────────────

function RatingPopup({
  type,
  candidate,
  articlesByBias,
  onClose,
}: {
  type: RatingKey;
  candidate: Candidate;
  articlesByBias: Record<Bias, number>;
  onClose: () => void;
}) {
  const ratings = candidate.ratings;

  const titles: Record<RatingKey, string> = {
    transparency: "Transparency Score",
    sentiment: "Sentiment Score",
    factual: "Factual Consistency Score",
    finance: "Campaign Finance Score",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-slate-900">{titles[type]}</h3>
            <p className="text-sm text-slate-500 mt-0.5">{candidate.fullName}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-sm text-slate-700 space-y-3">
          {type === "transparency" && (
            ratings?.transparencyScore != null ? (
              <>
                <p className="text-3xl font-bold text-slate-900">
                  {ratings.transparencyScore}
                  <span className="text-base font-normal text-slate-400 ml-1">/ 100</span>
                </p>
                <p className="text-xs text-slate-400">How this score is calculated:</p>
                <div className="space-y-1.5 text-xs border border-slate-100 rounded-lg divide-y divide-slate-100">
                  {[
                    ["Profile data completeness", "0–40 pts"],
                    ["Finance filing compliance", "0–30 pts"],
                    ["Public record depth", "0–20 pts"],
                    ["Data currency", "0–10 pts"],
                  ].map(([label, pts]) => (
                    <div key={label} className="flex justify-between px-3 py-2">
                      <span>{label}</span>
                      <span className="text-slate-400">{pts}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-slate-500">Insufficient data to calculate a Transparency Score.</p>
            )
          )}

          {type === "sentiment" && (
            <>
              <p className="text-slate-600">
                Articles are categorized by outlet type. Each type is scored separately. Minimum
                50 articles per category required.
              </p>
              <div className="border border-slate-100 rounded-lg divide-y divide-slate-100">
                {(["conservative", "liberal", "neutral"] as const).map((bias) => {
                  const count = articlesByBias[bias];
                  return (
                    <div key={bias} className="flex justify-between items-center px-3 py-2 text-xs">
                      <span className="capitalize">{bias} outlets</span>
                      <span className="text-slate-500">
                        {count < 50
                          ? `Insufficient (${count} article${count !== 1 ? "s" : ""})`
                          : `${count} articles`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {type === "factual" && (
            ratings?.factualConsistencyScore != null ? (
              <>
                <p className="text-3xl font-bold text-slate-900">
                  {ratings.factualConsistencyScore}
                  <span className="text-base font-normal text-slate-400 ml-1">/ 100</span>
                </p>
                <p className="text-xs text-slate-600">
                  Measures how well stated positions align with the voting record and documented
                  actions.
                </p>
              </>
            ) : candidate.votingRecords.length < 10 ? (
              <>
                <p className="font-medium text-slate-800">New Candidate / Minimal Voting Record</p>
                <p className="text-xs text-slate-600">
                  This candidate has fewer than 10 recorded votes. A Factual Consistency Score
                  requires a minimum of 10 votes to calculate reliably.
                  {!candidate.isIncumbent && " This candidate is not an incumbent."}
                </p>
              </>
            ) : (
              <p className="text-slate-500">Insufficient data to calculate a Factual Consistency Score.</p>
            )
          )}

          {type === "finance" && (
            ratings?.campaignFinanceScore != null ? (
              <>
                <p className="text-3xl font-bold text-slate-900">
                  {ratings.campaignFinanceScore}
                  <span className="text-base font-normal text-slate-400 ml-1">/ 100</span>
                </p>
                <p className="text-xs text-slate-600">
                  Evaluates donor composition, spending patterns, and disclosure completeness.
                </p>
                <p className="text-xs text-slate-400">
                  Note: Campaign Finance Score methodology is evolving.
                </p>
              </>
            ) : (
              <p className="text-slate-500">No campaign finance score available for this candidate.</p>
            )
          )}
        </div>

        <Link
          href="/methodology"
          onClick={onClose}
          className="block mt-5 text-xs text-blue-600 hover:underline"
        >
          Read full methodology →
        </Link>
      </div>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}
