// @vitest-environment jsdom
/**
 * CandidateSelector component tests
 *
 * Covers:
 *  - Same-race candidates render as quick-select buttons
 *  - Typing < 2 characters in search shows no results dropdown
 *  - Typing >= 2 characters filters allCandidates by case-insensitive name
 *    match, excluding slugA
 *  - Clicking a quick-select or search result candidate navigates to
 *    /compare?a={slugA}&b={slugB}
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CandidateSelector from "@/components/CandidateSelector";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const candidateA = {
  profileSlug: "jane-doe",
  fullName: "Jane Doe",
  party: "Democratic",
  status: "active",
  election: {
    status: "active",
    district: { name: "State Senate District 20" },
  },
};

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

describe("CandidateSelector", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("renders same-race candidates as quick-select buttons", () => {
    render(
      <CandidateSelector
        candidateA={candidateA}
        allCandidates={allCandidates}
        sameRaceSlugs={["john-smith"]}
        slugA="jane-doe"
      />
    );

    expect(screen.getByText("Same race")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /John Smith/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mary Jones/ })).not.toBeInTheDocument();
  });

  it("shows no results dropdown when the search query is under 2 characters", async () => {
    const user = userEvent.setup();
    render(
      <CandidateSelector
        candidateA={candidateA}
        allCandidates={allCandidates}
        sameRaceSlugs={[]}
        slugA="jane-doe"
      />
    );

    await user.type(screen.getByPlaceholderText("Type a name..."), "m");
    expect(screen.queryByText("No candidates found.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mary Jones/ })).not.toBeInTheDocument();
  });

  it("filters candidates case-insensitively by name and excludes slugA once 2+ characters are typed", async () => {
    const user = userEvent.setup();
    render(
      <CandidateSelector
        candidateA={candidateA}
        allCandidates={allCandidates}
        sameRaceSlugs={[]}
        slugA="jane-doe"
      />
    );

    await user.type(screen.getByPlaceholderText("Type a name..."), "JO");

    expect(screen.getByRole("button", { name: /John Smith/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mary Jones/ })).toBeInTheDocument();
    // "Jane Doe" matches slugA and must be excluded even though it contains "j".
    expect(screen.queryByRole("button", { name: /^Jane Doe/ })).not.toBeInTheDocument();
  });

  it("shows 'No candidates found.' when the search matches nothing", async () => {
    const user = userEvent.setup();
    render(
      <CandidateSelector
        candidateA={candidateA}
        allCandidates={allCandidates}
        sameRaceSlugs={[]}
        slugA="jane-doe"
      />
    );

    await user.type(screen.getByPlaceholderText("Type a name..."), "zzz");
    expect(screen.getByText("No candidates found.")).toBeInTheDocument();
  });

  it("navigates to /compare?a={slugA}&b={slugB} when a quick-select candidate is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CandidateSelector
        candidateA={candidateA}
        allCandidates={allCandidates}
        sameRaceSlugs={["john-smith"]}
        slugA="jane-doe"
      />
    );

    await user.click(screen.getByRole("button", { name: /John Smith/ }));
    expect(push).toHaveBeenCalledWith("/compare?a=jane-doe&b=john-smith");
  });

  it("navigates to /compare?a={slugA}&b={slugB} when a search result candidate is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CandidateSelector
        candidateA={candidateA}
        allCandidates={allCandidates}
        sameRaceSlugs={[]}
        slugA="jane-doe"
      />
    );

    await user.type(screen.getByPlaceholderText("Type a name..."), "Mary");
    await user.click(screen.getByRole("button", { name: /Mary Jones/ }));
    expect(push).toHaveBeenCalledWith("/compare?a=jane-doe&b=mary-jones");
  });
});
