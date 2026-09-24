import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OverCompletionScreen } from "./OverCompletionScreen";
import type { OverSummary } from "./overCompletionSummary";

const summary: OverSummary = {
  overNumber: 4,
  runsConceded: 7,
  wicketsThisOver: 1,
  isMaiden: false,
  bowlerFigures: { legalBallsBowled: 20, runsCharged: 18, wickets: 1, maidens: 0 },
};

describe("OverCompletionScreen (UX-16)", () => {
  it("shows the over number, runs conceded, and wickets", () => {
    render(
      <OverCompletionScreen summary={summary} ballsPerOver={6} onAcknowledge={vi.fn()} onJumpToCorrection={vi.fn()} />,
    );
    expect(screen.getByLabelText("Over summary")).toHaveTextContent("Over 4: 7 runs, 1 wickets");
  });

  it("shows a maiden badge when isMaiden is true", () => {
    render(
      <OverCompletionScreen
        summary={{ ...summary, isMaiden: true, runsConceded: 0 }}
        ballsPerOver={6}
        onAcknowledge={vi.fn()}
        onJumpToCorrection={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Over summary")).toHaveTextContent("Maiden");
  });

  it("bowler figures are hidden until expanded", async () => {
    const user = userEvent.setup();
    render(
      <OverCompletionScreen summary={summary} ballsPerOver={6} onAcknowledge={vi.fn()} onJumpToCorrection={vi.fn()} />,
    );
    expect(screen.queryByLabelText("Bowler figures")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand over detail" }));
    expect(screen.getByLabelText("Bowler figures")).toHaveTextContent("3.2 overs, 0 maidens, 18 runs, 1 wicket");
  });

  it("Continue calls onAcknowledge", async () => {
    const user = userEvent.setup();
    const onAcknowledge = vi.fn();
    render(
      <OverCompletionScreen summary={summary} ballsPerOver={6} onAcknowledge={onAcknowledge} onJumpToCorrection={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onAcknowledge).toHaveBeenCalledOnce();
  });

  it("Jump to Score Correction calls onJumpToCorrection", async () => {
    const user = userEvent.setup();
    const onJumpToCorrection = vi.fn();
    render(
      <OverCompletionScreen summary={summary} ballsPerOver={6} onAcknowledge={vi.fn()} onJumpToCorrection={onJumpToCorrection} />,
    );
    await user.click(screen.getByRole("button", { name: "Jump to Score Correction" }));
    expect(onJumpToCorrection).toHaveBeenCalledOnce();
  });

  it("auto-advances after the configured interval", async () => {
    vi.useFakeTimers();
    const onAcknowledge = vi.fn();
    render(
      <OverCompletionScreen
        summary={summary}
        ballsPerOver={6}
        autoAdvanceMs={3000}
        onAcknowledge={onAcknowledge}
        onJumpToCorrection={vi.fn()}
      />,
    );
    expect(onAcknowledge).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onAcknowledge).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
