// @vitest-environment jsdom
/**
 * Nav component tests
 *
 * Covers:
 *  - Renders logo link, desktop search input, mobile search icon link,
 *    "State Rankings" and "Methodology" links
 *  - Submitting the search form with a query >= 2 chars navigates to
 *    /search?q=<encoded query>
 *  - Submitting with < 2 chars does not navigate and refocuses the input
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Nav from "@/components/Nav";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("Nav", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("renders the logo link, search input, and nav links", () => {
    render(<Nav />);

    expect(screen.getByRole("link", { name: "Candidate Research" })).toHaveAttribute("href", "/");
    expect(screen.getByPlaceholderText("Search candidates...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search candidates" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "State Rankings" })).toHaveAttribute("href", "/rankings");
    expect(screen.getByRole("link", { name: "Methodology" })).toHaveAttribute("href", "/methodology");
  });

  it("navigates to /search?q=<encoded query> when submitting a query with 2+ characters", async () => {
    const user = userEvent.setup();
    render(<Nav />);

    const input = screen.getByPlaceholderText("Search candidates...");
    await user.type(input, "Jane Doe");
    await user.type(input, "{Enter}");

    expect(push).toHaveBeenCalledWith("/search?q=Jane%20Doe");
  });

  it("does not navigate and refocuses the input when the query is under 2 characters", async () => {
    const user = userEvent.setup();
    render(<Nav />);

    const input = screen.getByPlaceholderText("Search candidates...");
    await user.type(input, "a");
    await user.type(input, "{Enter}");

    expect(push).not.toHaveBeenCalled();
    expect(input).toHaveFocus();
  });

  it("trims whitespace before checking query length and does not navigate for a whitespace-only query", async () => {
    const user = userEvent.setup();
    render(<Nav />);

    const input = screen.getByPlaceholderText("Search candidates...");
    await user.type(input, "  a ");
    await user.type(input, "{Enter}");

    expect(push).not.toHaveBeenCalled();
  });
});
