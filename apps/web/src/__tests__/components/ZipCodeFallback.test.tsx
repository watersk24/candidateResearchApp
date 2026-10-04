// @vitest-environment jsdom
/**
 * ZipCodeFallback component tests
 *
 * Covers:
 *  - Input strips non-digit characters and caps length at 5
 *  - Submit button is disabled unless exactly 5 digits are entered
 *  - Submitting an invalid (non-5-digit) zip shows a validation error and
 *    does not call onSubmit
 *  - Submitting a valid 5-digit zip calls onSubmit and shows loading text
 *  - Clicking "Back" calls onBack
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ZipCodeFallback from "@/components/ZipCodeFallback";

describe("ZipCodeFallback", () => {
  it("strips non-digit characters and caps input at 5 characters", async () => {
    const user = userEvent.setup();
    render(<ZipCodeFallback onSubmit={vi.fn()} onBack={vi.fn()} />);

    const input = screen.getByPlaceholderText("12345") as HTMLInputElement;
    await user.type(input, "12a3b45");

    expect(input.value).toBe("12345");
  });

  it("disables the submit button unless exactly 5 digits have been entered", async () => {
    const user = userEvent.setup();
    render(<ZipCodeFallback onSubmit={vi.fn()} onBack={vi.fn()} />);

    const input = screen.getByPlaceholderText("12345");
    const button = screen.getByRole("button", { name: "Find my races" });

    expect(button).toBeDisabled();

    await user.type(input, "1234");
    expect(button).toBeDisabled();

    await user.type(input, "5");
    expect(button).toBeEnabled();
  });

  it("shows a validation error and does not call onSubmit for an incomplete zip", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ZipCodeFallback onSubmit={onSubmit} onBack={vi.fn()} />);

    const input = screen.getByPlaceholderText("12345");
    await user.type(input, "123");

    // The submit button is disabled with fewer than 5 digits (covered above),
    // but the component's own submit handler also validates the value with
    // /^\d{5}$/. Submit the form directly to exercise that validation branch.
    const form = input.closest("form")!;
    fireEvent.submit(form);

    expect(screen.getByText("Please enter a valid 5-digit US zip code.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with the zip and shows loading text for a valid 5-digit zip", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ZipCodeFallback onSubmit={onSubmit} onBack={vi.fn()} />);

    const input = screen.getByPlaceholderText("12345");
    await user.type(input, "12345");
    await user.click(screen.getByRole("button", { name: "Find my races" }));

    expect(onSubmit).toHaveBeenCalledWith("12345");
    expect(screen.getByText("Finding races...")).toBeInTheDocument();
  });

  it("calls onBack when the Back button is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<ZipCodeFallback onSubmit={vi.fn()} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(onBack).toHaveBeenCalled();
  });
});
