// @vitest-environment jsdom
/**
 * HomeFlow component tests
 *
 * HomeFlow is a state machine: permission -> zipcode/loading -> dashboard/error.
 * It talks to /api/districts, /api/races, and /api/geocode via the global
 * fetch. These are integration-style tests covering the main transitions:
 *
 *  - Happy path: grant location -> districts + races resolve -> Dashboard
 *    renders with the expected location label
 *  - Districts resolve to an empty array -> Dashboard renders with no races
 *    and /api/races is never called
 *  - A failing/non-ok fetch -> "error" screen shows with the fallback
 *    message, and "Try again" returns to the permission screen
 *  - Zip code path -> /api/geocode then reuses the district/races flow
 */

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomeFlow from "@/components/HomeFlow";

function mockGeolocationSuccess(lat = 36.16, lng = -86.78) {
  Object.defineProperty(global.navigator, "geolocation", {
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition);
      }),
    },
    configurable: true,
  });
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

const district = {
  id: "d-1",
  name: "TN State Senate District 20",
  level: "state",
  districtType: "State Senate",
  jurisdiction: { id: "j-1", name: "Tennessee", type: "state" },
};

const election = {
  id: "e-1",
  name: "State Senate General",
  electionType: "general",
  electionDate: "2026-11-03",
  status: "active",
  district: { name: district.name, level: "state", jurisdiction: { name: "Tennessee" } },
  candidates: [
    {
      id: "c-1",
      fullName: "Jane Doe",
      party: "Democratic",
      status: "active",
      profileSlug: "jane-doe",
      hasLimitedData: false,
      ratings: { transparencyScore: 80 },
    },
  ],
};

describe("HomeFlow", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error - reset between tests
    delete global.navigator.geolocation;
  });

  it("happy path: grants location, resolves districts and races, renders Dashboard", async () => {
    mockGeolocationSuccess();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => jsonResponse({ districts: [district] }))
      .mockImplementationOnce(() => jsonResponse({ elections: [election] }));

    const user = userEvent.setup();
    render(<HomeFlow />);

    await user.click(screen.getByRole("button", { name: "Allow location access" }));

    await waitFor(() => {
      expect(screen.getByText(/Your Races/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Tennessee/)).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/districts?lat=36.16&lng=-86.78")
    );
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/api/races?districtIds=d-1"));
  });

  it("renders Dashboard with no races and never calls /api/races when districts resolve empty", async () => {
    mockGeolocationSuccess();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      jsonResponse({ districts: [] })
    );

    const user = userEvent.setup();
    render(<HomeFlow />);

    await user.click(screen.getByRole("button", { name: "Allow location access" }));

    await waitFor(() => {
      expect(screen.getByText("No active races found")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/races"));
  });

  it("shows the error screen with the fallback message when a fetch fails, and 'Try again' returns to permission", async () => {
    mockGeolocationSuccess();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() =>
      jsonResponse({}, false)
    );

    const user = userEvent.setup();
    render(<HomeFlow />);

    await user.click(screen.getByRole("button", { name: "Allow location access" }));

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
    expect(
      screen.getByText("We couldn't load races for your location. Please try again.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByRole("button", { name: "Allow location access" })).toBeInTheDocument();
  });

  it("zip code path: geocodes the zip then loads districts and races", async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => jsonResponse({ lat: 36.16, lng: -86.78, label: "Nashville, TN" }))
      .mockImplementationOnce(() => jsonResponse({ districts: [district] }))
      .mockImplementationOnce(() => jsonResponse({ elections: [election] }));

    const user = userEvent.setup();
    render(<HomeFlow />);

    await user.click(screen.getByText("Enter my zip code instead"));
    const input = screen.getByPlaceholderText("12345");
    await user.type(input, "37201");
    await user.click(screen.getByRole("button", { name: "Find my races" }));

    await waitFor(() => {
      expect(screen.getByText(/Your Races/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Nashville, TN/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/api/geocode?zip=37201"));
  });
});
