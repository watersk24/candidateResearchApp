// @vitest-environment jsdom
/**
 * LocationPermissionScreen component tests
 *
 * Covers:
 *  - Clicking "Allow location access" with geolocation granted calls
 *    onLocationGranted with the coordinates from the success callback
 *  - Clicking "Allow location access" with geolocation denied/erroring
 *    shows the "Location access was denied" banner and calls onLocationDenied
 *  - Clicking "Enter my zip code instead" calls onUseZip directly, without
 *    touching geolocation
 *  - When navigator.geolocation is undefined entirely, clicking "Allow
 *    location access" calls onLocationDenied immediately
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LocationPermissionScreen from "@/components/LocationPermissionScreen";

function mockGeolocation(
  impl: (
    success: PositionCallback,
    error?: PositionErrorCallback
  ) => void
) {
  Object.defineProperty(global.navigator, "geolocation", {
    value: { getCurrentPosition: vi.fn(impl) },
    configurable: true,
  });
}

describe("LocationPermissionScreen", () => {
  afterEach(() => {
    // Remove any geolocation mock between tests so each test controls its
    // own environment explicitly.
    // @ts-expect-error - allowed to be undefined for the "no geolocation" case
    delete global.navigator.geolocation;
  });

  it("calls onLocationGranted with coordinates when geolocation succeeds", async () => {
    mockGeolocation((success) => {
      success({
        coords: { latitude: 36.16, longitude: -86.78 },
      } as GeolocationPosition);
    });

    const user = userEvent.setup();
    const onLocationGranted = vi.fn();
    render(
      <LocationPermissionScreen
        onLocationGranted={onLocationGranted}
        onUseZip={vi.fn()}
        onLocationDenied={vi.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Allow location access" }));

    expect(onLocationGranted).toHaveBeenCalledWith(36.16, -86.78);
  });

  it("shows the denied banner and calls onLocationDenied when geolocation errors", async () => {
    mockGeolocation((_success, error) => {
      error?.({} as GeolocationPositionError);
    });

    const user = userEvent.setup();
    const onLocationDenied = vi.fn();
    render(
      <LocationPermissionScreen
        onLocationGranted={vi.fn()}
        onUseZip={vi.fn()}
        onLocationDenied={onLocationDenied}
      />
    );

    await user.click(screen.getByRole("button", { name: "Allow location access" }));

    expect(onLocationDenied).toHaveBeenCalled();
    expect(
      screen.getByText("Location access was denied. Enter your zip code to continue.")
    ).toBeInTheDocument();
  });

  it("calls onUseZip directly when 'Enter my zip code instead' is clicked, without touching geolocation", async () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(global.navigator, "geolocation", {
      value: { getCurrentPosition },
      configurable: true,
    });

    const user = userEvent.setup();
    const onUseZip = vi.fn();
    render(
      <LocationPermissionScreen
        onLocationGranted={vi.fn()}
        onUseZip={onUseZip}
        onLocationDenied={vi.fn()}
      />
    );

    await user.click(screen.getByText("Enter my zip code instead"));

    expect(onUseZip).toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("calls onLocationDenied immediately when navigator.geolocation is undefined", async () => {
    const user = userEvent.setup();
    const onLocationDenied = vi.fn();
    render(
      <LocationPermissionScreen
        onLocationGranted={vi.fn()}
        onUseZip={vi.fn()}
        onLocationDenied={onLocationDenied}
      />
    );

    await user.click(screen.getByRole("button", { name: "Allow location access" }));

    expect(onLocationDenied).toHaveBeenCalled();
  });
});
