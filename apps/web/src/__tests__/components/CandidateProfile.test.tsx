// @vitest-environment jsdom
/**
 * CandidateProfile component tests
 *
 * Covers:
 *  - Withdrawn / stale-data / limited-data banners render conditionally
 *  - Rating cards render a score, "No data", or "Limited data" depending on
 *    the score value and ratings.dataStatus
 *  - Clicking a rating's info icon opens the matching RatingPopup; closing
 *    via the close button or the backdrop click both work
 *  - Voting record: empty-state message differs by isIncumbent; "Show all
 *    N votes" toggle only appears when > 5 records, and toggles the list
 *  - Sentiment breakdown: "Insufficient coverage data" below the 50-article
 *    threshold; Positive/Negative/Neutral labels above threshold
 *  - Campaign finance, public statements, legal history, and business
 *    affiliations each have empty-state text, with a non-empty spot check
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidateProfile from "@/components/CandidateProfile";

// ─── Fixture builders ──────────────────────────────────────────────────────

type Bias = "conservative" | "liberal" | "neutral";

function makeArticles(counts: Record<Bias, number>) {
  const articles: { id: string; outlet: { bias: Bias } }[] = [];
  (Object.keys(counts) as Bias[]).forEach((bias) => {
    for (let i = 0; i < counts[bias]; i++) {
      articles.push({ id: `${bias}-${i}`, outlet: { bias } });
    }
  });
  return articles;
}

function baseCandidate(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Jane Doe",
    party: "Democratic",
    status: "active" as const,
    isIncumbent: true,
    profileSlug: "jane-doe",
    officialWebsiteUrl: null,
    lastRefreshedAt: "2026-07-01T12:00:00Z",
    dataIsStale: false,
    hasLimitedData: false,
    election: {
      name: "General Election",
      electionType: "general",
      electionDate: "2026-11-03",
      status: "active" as const,
      district: { name: "State Senate District 20", level: "state" },
    },
    votingRecords: [],
    campaignFinanceRecords: [],
    publicStatements: [],
    legalHistory: [],
    businessAffiliations: [],
    newsArticles: [],
    ratings: {
      transparencyScore: 80,
      sentimentConservative: null,
      sentimentLiberal: null,
      sentimentNeutral: null,
      factualConsistencyScore: 70,
      campaignFinanceScore: 60,
      dataStatus: "current" as const,
    },
    ...overrides,
  };
}

function makeVotingRecord(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `v-${i}`,
    billOrMeasure: `Bill ${i}`,
    vote: "yea",
    voteDate: "2026-01-0" + ((i % 9) + 1),
    sourceUrl: "https://example.com/source",
    sourceAvailable: true,
    ...overrides,
  };
}

// ─── Banners ────────────────────────────────────────────────────────────────

describe("CandidateProfile banners", () => {
  it("shows no banners for a normal active candidate with current data", () => {
    render(<CandidateProfile candidate={baseCandidate() as never} />);
    expect(screen.queryByText(/withdrawn from the race/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Data refresh overdue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Limited Data Available/)).not.toBeInTheDocument();
  });

  it("shows the withdrawn banner when status is withdrawn", () => {
    render(<CandidateProfile candidate={baseCandidate({ status: "withdrawn" }) as never} />);
    expect(
      screen.getByText(/This candidate has withdrawn from the race/)
    ).toBeInTheDocument();
  });

  it("shows the stale-data banner with the refreshed date when dataIsStale is true", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({ dataIsStale: true, lastRefreshedAt: "2026-01-15T09:30:00Z" }) as never}
      />
    );
    expect(screen.getByText(/Data refresh overdue/)).toBeInTheDocument();
    expect(screen.getByText(/Last refreshed:/)).toBeInTheDocument();
  });

  it("shows the limited-data banner when hasLimitedData is true", () => {
    render(<CandidateProfile candidate={baseCandidate({ hasLimitedData: true }) as never} />);
    expect(screen.getByText(/Limited Data Available/)).toBeInTheDocument();
  });
});

// ─── Rating cards & popups ──────────────────────────────────────────────────

describe("CandidateProfile rating cards and popups", () => {
  it("renders numeric scores for ratings that have a score", () => {
    render(<CandidateProfile candidate={baseCandidate() as never} />);
    expect(screen.getByText("80")).toBeInTheDocument(); // transparency
    expect(screen.getByText("70")).toBeInTheDocument(); // factual
    expect(screen.getByText("60")).toBeInTheDocument(); // finance
  });

  it("shows 'No data' when ratings is null", () => {
    render(<CandidateProfile candidate={baseCandidate({ ratings: null }) as never} />);
    const noDataLabels = screen.getAllByText("No data");
    // Transparency, Factual, Finance cards should all show "No data".
    expect(noDataLabels.length).toBe(3);
  });

  it("shows 'Limited data' when dataStatus is 'limited' and score is null", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({
          ratings: {
            transparencyScore: null,
            sentimentConservative: null,
            sentimentLiberal: null,
            sentimentNeutral: null,
            factualConsistencyScore: null,
            campaignFinanceScore: null,
            dataStatus: "limited",
          },
        }) as never}
      />
    );
    expect(screen.getAllByText("Limited data").length).toBeGreaterThanOrEqual(3);
  });

  it("opens the Transparency rating popup with matching title and score, and closes via the close button", async () => {
    const user = userEvent.setup();
    render(<CandidateProfile candidate={baseCandidate() as never} />);

    await user.click(screen.getByLabelText("Open Transparency explanation"));

    const popupTitle = screen.getByRole("heading", { name: "Transparency Score" });
    expect(popupTitle).toBeInTheDocument();
    // Popup shows the candidate's name alongside the title (also appears in
    // the page header, so there are two matches while the popup is open).
    expect(screen.getAllByText("Jane Doe").length).toBe(2);

    await user.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("heading", { name: "Transparency Score" })).not.toBeInTheDocument();
  });

  it("closes the rating popup when clicking the backdrop", async () => {
    const user = userEvent.setup();
    render(<CandidateProfile candidate={baseCandidate() as never} />);

    await user.click(screen.getByLabelText("Open Factual Consistency explanation"));
    expect(screen.getByRole("heading", { name: "Factual Consistency Score" })).toBeInTheDocument();

    // The backdrop is the popup's outer fixed overlay div; clicking it
    // (rather than the inner white card) should close the popup.
    const heading = screen.getByRole("heading", { name: "Factual Consistency Score" });
    const backdrop = heading.closest("div.fixed")!;
    await user.click(backdrop);

    expect(screen.queryByRole("heading", { name: "Factual Consistency Score" })).not.toBeInTheDocument();
  });

  it("shows the 'fewer than 10 votes' explanation in the Factual popup when applicable", async () => {
    const user = userEvent.setup();
    render(
      <CandidateProfile
        candidate={baseCandidate({
          ratings: {
            transparencyScore: 80,
            sentimentConservative: null,
            sentimentLiberal: null,
            sentimentNeutral: null,
            factualConsistencyScore: null,
            campaignFinanceScore: 60,
            dataStatus: "current",
          },
          votingRecords: [makeVotingRecord(1)],
        }) as never}
      />
    );

    await user.click(screen.getByLabelText("Open Factual Consistency explanation"));
    expect(screen.getByText(/fewer than 10 recorded votes/)).toBeInTheDocument();
  });
});

// ─── Voting record ──────────────────────────────────────────────────────────

describe("CandidateProfile voting record", () => {
  it("shows the incumbent empty-state message when isIncumbent is true and there are no votes", () => {
    render(<CandidateProfile candidate={baseCandidate({ isIncumbent: true, votingRecords: [] }) as never} />);
    expect(
      screen.getByText(/No voting record data is available from public sources/)
    ).toBeInTheDocument();
  });

  it("shows the non-incumbent empty-state message when isIncumbent is false and there are no votes", () => {
    render(<CandidateProfile candidate={baseCandidate({ isIncumbent: false, votingRecords: [] }) as never} />);
    expect(
      screen.getByText(/This candidate has not previously held office/)
    ).toBeInTheDocument();
  });

  it("does not show the 'Show all' toggle with 5 or fewer voting records", () => {
    const votingRecords = Array.from({ length: 5 }, (_, i) => makeVotingRecord(i));
    render(<CandidateProfile candidate={baseCandidate({ votingRecords }) as never} />);
    expect(screen.queryByText(/Show all/)).not.toBeInTheDocument();
  });

  it("shows and toggles the 'Show all N votes' button when there are more than 5 records", async () => {
    const user = userEvent.setup();
    const votingRecords = Array.from({ length: 8 }, (_, i) => makeVotingRecord(i));
    render(<CandidateProfile candidate={baseCandidate({ votingRecords }) as never} />);

    expect(screen.getByText("Bill 0")).toBeInTheDocument();
    expect(screen.queryByText("Bill 5")).not.toBeInTheDocument();

    const toggle = screen.getByText("Show all 8 votes");
    await user.click(toggle);

    expect(screen.getByText("Bill 5")).toBeInTheDocument();
    expect(screen.getByText("Show fewer")).toBeInTheDocument();

    await user.click(screen.getByText("Show fewer"));
    expect(screen.queryByText("Bill 5")).not.toBeInTheDocument();
  });
});

// ─── Sentiment breakdown ────────────────────────────────────────────────────

describe("CandidateProfile sentiment breakdown", () => {
  it("shows 'Insufficient coverage data' for an outlet type below the 50-article threshold", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({ newsArticles: makeArticles({ conservative: 10, liberal: 0, neutral: 0 }) }) as never}
      />
    );
    const insufficient = screen.getAllByText(/Insufficient coverage data/);
    expect(insufficient.length).toBe(3);
  });

  it("shows a Positive label when sentiment score is >= 0.6 and coverage is sufficient", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({
          newsArticles: makeArticles({ conservative: 60, liberal: 0, neutral: 0 }),
          ratings: {
            transparencyScore: 80,
            sentimentConservative: 0.75,
            sentimentLiberal: null,
            sentimentNeutral: null,
            factualConsistencyScore: 70,
            campaignFinanceScore: 60,
            dataStatus: "current",
          },
        }) as never}
      />
    );
    expect(screen.getByText("Positive")).toBeInTheDocument();
  });

  it("shows a Negative label when sentiment score is <= 0.4 and coverage is sufficient", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({
          newsArticles: makeArticles({ conservative: 60, liberal: 0, neutral: 0 }),
          ratings: {
            transparencyScore: 80,
            sentimentConservative: 0.2,
            sentimentLiberal: null,
            sentimentNeutral: null,
            factualConsistencyScore: 70,
            campaignFinanceScore: 60,
            dataStatus: "current",
          },
        }) as never}
      />
    );
    expect(screen.getByText("Negative")).toBeInTheDocument();
  });

  it("shows a Neutral label when sentiment score is between 0.4 and 0.6 and coverage is sufficient", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({
          newsArticles: makeArticles({ conservative: 60, liberal: 0, neutral: 0 }),
          ratings: {
            transparencyScore: 80,
            sentimentConservative: 0.5,
            sentimentLiberal: null,
            sentimentNeutral: null,
            factualConsistencyScore: 70,
            campaignFinanceScore: 60,
            dataStatus: "current",
          },
        }) as never}
      />
    );
    expect(screen.getByText("Neutral")).toBeInTheDocument();
  });
});

// ─── Campaign finance / statements / legal / business ───────────────────────

describe("CandidateProfile detail sections", () => {
  it("shows the empty-state text for campaign finance when there are no records", () => {
    render(<CandidateProfile candidate={baseCandidate({ campaignFinanceRecords: [] }) as never} />);
    expect(
      screen.getByText(/No campaign finance records available from public sources/)
    ).toBeInTheDocument();
  });

  it("renders a non-empty campaign finance record", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({
          campaignFinanceRecords: [
            {
              id: "f-1",
              filingPeriod: "2026-Q2",
              totalRaised: "125000",
              individualDonorPct: "60.5",
              pacDonorPct: "30",
              partyTransferPct: "9.5",
              totalSpent: "80000",
              filingComplete: true,
              sourceUrl: "https://example.com",
              sourceAvailable: true,
            },
          ],
        }) as never}
      />
    );
    expect(screen.getByText("$125,000")).toBeInTheDocument();
    expect(screen.getByText("60.5%")).toBeInTheDocument();
    expect(screen.getByText("All filings current")).toBeInTheDocument();
  });

  it("shows the empty-state text for public statements when there are none", () => {
    render(<CandidateProfile candidate={baseCandidate({ publicStatements: [] }) as never} />);
    expect(screen.getByText(/No public statements found in official records/)).toBeInTheDocument();
  });

  it("renders a non-empty public statement", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({
          publicStatements: [
            {
              id: "s-1",
              statementExcerpt: "I support this bill.",
              statementDate: "2026-02-01",
              sourceType: "floor speech",
              sourceUrl: "https://example.com",
              sourceAvailable: true,
            },
          ],
        }) as never}
      />
    );
    expect(screen.getByText(/I support this bill\./)).toBeInTheDocument();
  });

  it("shows the empty-state text for legal history when there are no entries", () => {
    render(<CandidateProfile candidate={baseCandidate({ legalHistory: [] }) as never} />);
    expect(screen.getByText(/No legal history found in public records/)).toBeInTheDocument();
  });

  it("renders a non-empty legal history entry", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({
          legalHistory: [
            {
              id: "l-1",
              caseType: "civil",
              caseDate: "2020-05-01",
              jurisdiction: "Davidson County",
              outcome: "Dismissed",
              sourceUrl: "https://example.com",
              sourceAvailable: true,
            },
          ],
        }) as never}
      />
    );
    expect(screen.getByText("civil")).toBeInTheDocument();
    expect(screen.getByText(/Dismissed/)).toBeInTheDocument();
  });

  it("shows the empty-state text for business affiliations when there are none", () => {
    render(<CandidateProfile candidate={baseCandidate({ businessAffiliations: [] }) as never} />);
    expect(
      screen.getByText(/No business affiliations found in public records/)
    ).toBeInTheDocument();
  });

  it("renders a non-empty business affiliation", () => {
    render(
      <CandidateProfile
        candidate={baseCandidate({
          businessAffiliations: [
            {
              id: "b-1",
              entityName: "Acme LLC",
              role: "Owner",
              stateOfRegistration: "TN",
              sourceUrl: "https://example.com",
              sourceAvailable: true,
            },
          ],
        }) as never}
      />
    );
    expect(screen.getByText("Acme LLC")).toBeInTheDocument();
    expect(screen.getByText(/Owner · TN/)).toBeInTheDocument();
  });
});
