// @vitest-environment jsdom
/**
 * Dashboard component tests
 *
 * Covers:
 *  - Empty elections -> "No active races found" empty state, and "Try a
 *    different location" calls onRefineLocation
 *  - Elections grouped by level (federal/state/local) render as sections,
 *    each collapsible via the toggle button
 *  - District chips show only the first 8, with "+N more" when > 8, and
 *    toggle the district panel open/closed
 *  - Withdrawn candidates render with strikethrough/"Withdrawn" and are not
 *    linked; active candidates link to /candidates/{slug}
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "@/components/Dashboard";
import type { ResolvedDistrict, Election } from "@/components/HomeFlow";

function makeDistrict(i: number, level: "federal" | "state" | "local" = "federal"): ResolvedDistrict {
  return {
    id: `d-${i}`,
    name: `District ${i}`,
    level,
    districtType: "Congressional",
    jurisdiction: { id: "j-1", name: "Tennessee", type: "state" },
  };
}

function makeElection(overrides: Partial<Election> = {}): Election {
  return {
    id: "e-1",
    name: "General Election",
    electionType: "general",
    electionDate: "2026-11-03",
    status: "active",
    district: { name: "District 1", level: "federal", jurisdiction: { name: "Tennessee" } },
    candidates: [
      {
        id: "c-1",
        fullName: "Jane Doe",
        party: "Democratic",
        status: "active",
        profileSlug: "jane-doe",
        hasLimitedData: false,
        ratings: null,
      },
    ],
    ...overrides,
  };
}

describe("Dashboard", () => {
  it("shows the empty state and calls onRefineLocation when no elections exist", async () => {
    const user = userEvent.setup();
    const onRefineLocation = vi.fn();
    render(
      <Dashboard
        locationLabel="Tennessee"
        districts={[]}
        elections={[]}
        onRefineLocation={onRefineLocation}
      />
    );

    expect(screen.getByText("No active races found")).toBeInTheDocument();
    await user.click(screen.getByText("Try a different location."));
    expect(onRefineLocation).toHaveBeenCalled();
  });

  it("groups elections by level into collapsible sections", async () => {
    const user = userEvent.setup();
    const elections = [
      makeElection({
        id: "fed-1",
        district: { name: "US House 5", level: "federal", jurisdiction: { name: "Tennessee" } },
      }),
      makeElection({
        id: "state-1",
        name: "State Senate Race",
        district: { name: "State Senate 20", level: "state", jurisdiction: { name: "Tennessee" } },
        candidates: [
          {
            id: "c-2",
            fullName: "John Smith",
            party: "Republican",
            status: "active",
            profileSlug: "john-smith",
            hasLimitedData: false,
            ratings: null,
          },
        ],
      }),
    ];

    render(
      <Dashboard
        locationLabel="Tennessee"
        districts={[makeDistrict(1, "federal"), makeDistrict(2, "state")]}
        elections={elections}
        onRefineLocation={vi.fn()}
      />
    );

    expect(screen.getByText("Federal")).toBeInTheDocument();
    expect(screen.getByText("State")).toBeInTheDocument();
    expect(screen.queryByText("Local")).not.toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("John Smith")).toBeInTheDocument();

    // Collapse the Federal section via its toggle button.
    const federalToggle = screen.getByText("Federal").closest("button")!;
    await user.click(federalToggle);
    expect(screen.queryByText("Jane Doe")).not.toBeInTheDocument();
    // State section remains expanded.
    expect(screen.getByText("John Smith")).toBeInTheDocument();

    // Expand it again.
    await user.click(federalToggle);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("shows only the first 8 district chips with a '+N more' button, and toggles the district panel", async () => {
    const user = userEvent.setup();
    const districts = Array.from({ length: 10 }, (_, i) => makeDistrict(i + 1));

    render(
      <Dashboard
        locationLabel="Tennessee"
        districts={districts}
        elections={[makeElection()]}
        onRefineLocation={vi.fn()}
      />
    );

    for (let i = 1; i <= 8; i++) {
      expect(screen.getByText(`District ${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText("District 9")).not.toBeInTheDocument();
    expect(screen.getByText("+2 more")).toBeInTheDocument();

    expect(screen.queryByText("Your Districts")).not.toBeInTheDocument();
    await user.click(screen.getByText("+2 more"));
    expect(screen.getByText("Your Districts")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Close district panel"));
    expect(screen.queryByText("Your Districts")).not.toBeInTheDocument();
  });

  it("renders withdrawn candidates unlinked with a Withdrawn label, and active candidates as links", () => {
    const election = makeElection({
      candidates: [
        {
          id: "c-1",
          fullName: "Jane Doe",
          party: "Democratic",
          status: "active",
          profileSlug: "jane-doe",
          hasLimitedData: false,
          ratings: null,
        },
        {
          id: "c-2",
          fullName: "Withdrawn Candidate",
          party: "Independent",
          status: "withdrawn",
          profileSlug: "withdrawn-candidate",
          hasLimitedData: false,
          ratings: null,
        },
      ],
    });

    render(
      <Dashboard
        locationLabel="Tennessee"
        districts={[]}
        elections={[election]}
        onRefineLocation={vi.fn()}
      />
    );

    const activeLink = screen.getByRole("link", { name: /Jane Doe/ });
    expect(activeLink).toHaveAttribute("href", "/candidates/jane-doe");

    expect(screen.getByText("Withdrawn Candidate")).toBeInTheDocument();
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Withdrawn Candidate/ })).not.toBeInTheDocument();
  });
});
