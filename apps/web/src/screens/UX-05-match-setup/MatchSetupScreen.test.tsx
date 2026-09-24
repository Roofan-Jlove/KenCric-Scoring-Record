import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MatchSetupScreen } from "./MatchSetupScreen";

describe("MatchSetupScreen (UX-05)", () => {
  it("Continue starts disabled -- no Must-have fields filled", () => {
    render(<MatchSetupScreen isLocked={false} onContinue={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("filling both Must-have fields enables Continue", async () => {
    const user = userEvent.setup();
    render(<MatchSetupScreen isLocked={false} onContinue={vi.fn()} />);

    await user.type(screen.getByLabelText("Overs per innings"), "20");
    await user.type(screen.getByLabelText("Match time zone"), "Asia/Karachi");

    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("overs_allotted = 0 shows an inline error and keeps Continue disabled (B-B1)", async () => {
    const user = userEvent.setup();
    render(<MatchSetupScreen isLocked={false} onContinue={vi.fn()} />);

    await user.type(screen.getByLabelText("Overs per innings"), "0");
    await user.type(screen.getByLabelText("Match time zone"), "Asia/Karachi");

    expect(screen.getByRole("alert")).toHaveTextContent("positive integer");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  // I-B1: powerplayOvers > oversAllotted flags BOTH fields.
  it("a powerplay exceeding overs allotted shows errors on both fields", async () => {
    const user = userEvent.setup();
    render(<MatchSetupScreen isLocked={false} onContinue={vi.fn()} />);

    await user.type(screen.getByLabelText("Overs per innings"), "10");
    await user.type(screen.getByLabelText("Powerplay overs"), "15");
    await user.type(screen.getByLabelText("Match time zone"), "Asia/Karachi");

    const oversInput = screen.getByLabelText("Overs per innings");
    const powerplayInput = screen.getByLabelText("Powerplay overs");
    expect(oversInput).toHaveAttribute("aria-invalid", "true");
    expect(powerplayInput).toHaveAttribute("aria-invalid", "true");
  });

  it("the checklist reflects Must-have completeness as a real list", async () => {
    const user = userEvent.setup();
    render(<MatchSetupScreen isLocked={false} onContinue={vi.fn()} />);
    expect(screen.getByRole("list", { name: "Setup completeness checklist" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Overs per innings"), "20");
    await user.type(screen.getByLabelText("Match time zone"), "Asia/Karachi");

    const items = screen.getAllByRole("listitem");
    expect(items.every((item) => item.textContent?.includes("complete"))).toBe(true);
  });

  it("submitting with valid data calls onContinue with the form state", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<MatchSetupScreen isLocked={false} onContinue={onContinue} />);

    await user.type(screen.getByLabelText("Overs per innings"), "20");
    await user.type(screen.getByLabelText("Match time zone"), "Asia/Karachi");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onContinue.mock.calls[0][0].oversAllotted).toBe(20);
  });

  it("a locked match shows the locked message instead of the form", () => {
    render(<MatchSetupScreen isLocked={true} onContinue={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("locked");
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });
});
