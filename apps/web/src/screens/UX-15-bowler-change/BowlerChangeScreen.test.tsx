import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BowlerChangeScreen } from "./BowlerChangeScreen";
import type { BowlerCandidate } from "./bowlerChangeForm";

const candidates: BowlerCandidate[] = [
  { id: "b1", name: "J. Smith", legalBallsBowled: 18, runsCharged: 18, wickets: 1, maidens: 0 },
  { id: "b2", name: "R. Jones", legalBallsBowled: 0, runsCharged: 0, wickets: 0, maidens: 0 },
];

const baseProps = {
  candidates,
  previousOverBowlerId: "b1",
  bowlerOverCap: 4,
  ballsPerOver: 6,
  isAuthorisedToOverride: true,
  onConfirm: vi.fn(),
};

describe("BowlerChangeScreen (UX-15)", () => {
  it("each bowler's accessible label includes their current figures", () => {
    render(<BowlerChangeScreen {...baseProps} />);
    expect(screen.getByRole("option", { name: "J. Smith, 3.0 overs, 0 maidens, 18 runs, 1 wicket" })).toBeInTheDocument();
  });

  it("the immediately preceding over's bowler is disabled with a stated reason", () => {
    render(<BowlerChangeScreen {...baseProps} isAuthorisedToOverride={false} />);
    const option = screen.getByRole("option", { name: /J. Smith/ });
    expect(option).toBeDisabled();
    expect(screen.getByText("Same bowler can't bowl consecutive overs")).toBeInTheDocument();
  });

  it("selecting an unblocked bowler and confirming calls onConfirm with no override reason", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<BowlerChangeScreen {...baseProps} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("option", { name: /R. Jones/ }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledWith("b2", null);
  });

  it("selecting a guardrail-blocked bowler (when authorised) requires an override reason before confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<BowlerChangeScreen {...baseProps} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("option", { name: /J. Smith/ }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("An override requires a reason")).toBeInTheDocument();
  });

  it("a completed override reason confirms the blocked selection", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<BowlerChangeScreen {...baseProps} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("option", { name: /J. Smith/ }));
    await user.type(screen.getByLabelText("Override reason"), "No other bowler available");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith("b1", "No other bowler available");
  });

  it("Confirm starts disabled with no bowler selected", () => {
    render(<BowlerChangeScreen {...baseProps} />);
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});
