// @vitest-environment jsdom
/**
 * ComparisonView component tests
 *
 * Covers:
 *  - Both candidate headers render with badges (incumbent, election status,
 *    limited data)
 *  - Changing the side-A select navigates with a=<new>, keeping b= the same;
 *    changing side-B keeps a= the same and updates b=
 *  - Rating popups open per-side with the correct title and candidate name,
 *    and close correctly
 *  - Sentiment / voting / finance / legal / business sections render
 *    empty-state text for a side with empty arrays
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComparisonView from "@/components/ComparisonView";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Jane Doe",
    party: "Democratic",
    status: "active",
    isIncumbent: false,
    profileSlug: "jane-doe",
    hasLimitedData: false,
    votingRecords: [],
    campaignFinanceRecords: [],
    legalHistory: [],
    businessAffiliations: [],
    newsArticles: [],
    ratings: null,
    election: {
      name: "General Election",
      status: "active",
      district: { name: "State Senate District 20", level: "state" },
    },
    ...overrides,
  };
}

const allCandidates = [
  {
    profileSlug: "jane-doe",
    fullName: "Jane Doe",
    party: "Democratic",
    election: { district: { name: "State Senate District 20" } },
  },
  {
    profileSlug: "john-smith",
    fullName: "John Smith",
    party: "Republican",
    election: { district: { name: "State Senate District 20" } },
  },
  {
    profileSlug: "mary-jones",
    fullName: "Mary Jones",
    party: "Independent",
    election: { district: { name: "US House District 5" } },
  },
];

describe("ComparisonView", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("renders both candidate headers with incumbent, election status, and limited-data badges", () => {
    const candidateA = makeCandidate({
      isIncumbent: true,
      hasLimitedData: true,
      election: { name: "General", status: "active", district: { name: "District A", level: "state" } },
    });
    const candidateB = makeCandidate({
      fullName: "John Smith",
      profileSlug: "john-smith",
      election: { name: "General", status: "upcoming", district: { name: "District B", level: "state" } },
    });

    render(
      <ComparisonView
        candidateA={candidateA as never}
        candidateB={candidateB as never}
        allCandidates={allCandidates}
        slugA="jane-doe"
        slugB="john-smith"
      />
    );

    expect(screen.getByText("Incumbent")).toBeInTheDocument();
    expect(screen.getByText("Limited data")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jane Doe" })).toHaveAttribute("href", "/candidates/jane-doe");
    expect(screen.getByRole("link", { name: "John Smith" })).toHaveAttribute("href", "/candidates/john-smith");
  });

  it("navigates keeping b= fixed when the side-A select changes", async () => {
    const user = userEvent.setup();
    const candidateA = makeCandidate();
    const candidateB = makeCandidate({ fullName: "John Smith", profileSlug: "john-smith" });

    render(
      <ComparisonView
        candidateA={candidateA as never}
        candidateB={candidateB as never}
        allCandidates={allCandidates}
        slugA="jane-doe"
        slugB="john-smith"
      />
    );

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[0], "mary-jones");

    expect(push).toHaveBeenCalledWith("/compare?a=mary-jones&b=john-smith");
  });

  it("navigates keeping a= fixed when the side-B select changes", async () => {
    const user = userEvent.setup();
    const candidateA = makeCandidate();
    const candidateB = makeCandidate({ fullName: "John Smith", profileSlug: "john-smith" });

    render(
      <ComparisonView
        candidateA={candidateA as never}
        candidateB={candidateB as never}
        allCandidates={allCandidates}
        slugA="jane-doe"
        slugB="john-smith"
      />
    );

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1], "mary-jones");

    expect(push).toHaveBeenCalledWith("/compare?a=jane-doe&b=mary-jones");
  });

  it("opens a rating popup for the correct side with the matching title and candidate name, and closes it", async () => {
    const user = userEvent.setup();
    const candidateA = makeCandidate({
      ratings: {
        transparencyScore: 90,
        sentimentConservative: null,
        sentimentLiberal: null,
        sentimentNeutral: null,
        factualConsistencyScore: null,
        campaignFinanceScore: null,
        dataStatus: "current",
      },
    });
    const candidateB = makeCandidate({ fullName: "John Smith", profileSlug: "john-smith" });

    render(
      <ComparisonView
        candidateA={candidateA as never}
        candidateB={candidateB as never}
        allCandidates={allCandidates}
        slugA="jane-doe"
        slugB="john-smith"
      />
    );

    await user.click(screen.getByLabelText("Open Transparency explanation for Jane Doe"));

    expect(screen.getByRole("heading", { name: "Transparency Score" })).toBeInTheDocument();
    // Candidate name appears in the popup subtitle in addition to the header link.
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThanOrEqual(2);

    await user.click(screen.getByLabelText("Close"));
    expect(screen.queryByRole("heading", { name: "Transparency Score" })).not.toBeInTheDocument();
  });

  it("shows empty-state text for sentiment, voting, finance, legal, and business sections for a side with empty data", () => {
    const candidateA = makeCandidate({ isIncumbent: false });
    const candidateB = makeCandidate({ fullName: "John Smith", profileSlug: "john-smith", isIncumbent: true });

    render(
      <ComparisonView
        candidateA={candidateA as never}
        candidateB={candidateB as never}
        allCandidates={allCandidates}
        slugA="jane-doe"
        slugB="john-smith"
      />
    );

    // Voting record empty state differs by isIncumbent: side A (not an
    // incumbent) gets "No prior office held.", side B (an incumbent) gets
    // "No records available." — the same "No records available." text is
    // also used for both sides' empty campaign finance, so it appears 3
    // times total (1 voting + 2 finance).
    expect(screen.getByText("No prior office held.")).toBeInTheDocument();
    expect(screen.getAllByText("No records available.").length).toBe(3);

    // Both sides have no legal history or business affiliations — these
    // share the same empty-state text across both sections and columns.
    expect(screen.getAllByText("None found in public records.").length).toBe(4); // legal x2 + business x2

    // Sentiment: 0 articles on both sides is below the 50-article threshold.
    expect(screen.getAllByText(/Insufficient/).length).toBe(6); // 3 bias rows x 2 sides
  });
});
