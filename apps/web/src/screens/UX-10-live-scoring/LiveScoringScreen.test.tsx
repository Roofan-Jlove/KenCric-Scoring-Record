import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LiveScoringScreen } from "./LiveScoringScreen";

const baseProps = {
  strikerName: "Alice",
  nonStrikerName: "Bea",
  bowlerName: "Cara",
  runs: 90,
  wickets: 3,
  legalBallsBowled: 75,
  totalBallsAllotted: 120,
  ballsPerOver: 6,
  extras: { byes: 1, legByes: 2, wides: 3, noBalls: 1, penalties: 0 },
  target: null as number | null,
  inningsNumber: 1,
  isOnline: true,
  lastBallAnnouncement: "Dot ball. 90 for 3.",
  stateInputs: {
    legalBallsBowled: 75,
    isBetweenOvers: false,
    isInningsBreak: false,
    isPaused: false,
    isReconciliationBlocked: false,
    isComplete: false,
  },
  onScoreBall: vi.fn(),
  onRecordWicket: vi.fn(),
  onRecordExtra: vi.fn(),
  onUndoLast: vi.fn(),
  onPause: vi.fn(),
  onOpenBallByBall: vi.fn(),
  onOpenScorecard: vi.fn(),
  onReviewStrike: vi.fn(),
};

describe("LiveScoringScreen (UX-10)", () => {
  it("shows the score, overs in O.B notation, and run rate", () => {
    render(<LiveScoringScreen {...baseProps} />);
    expect(screen.getByLabelText("Score")).toHaveTextContent("90 for 3 (12.3 overs)");
    expect(screen.getByLabelText("Run rate")).toHaveTextContent("7.20");
  });

  it("shows the connectivity indicator", () => {
    render(<LiveScoringScreen {...baseProps} isOnline={false} />);
    expect(screen.getByRole("status", { name: "Connectivity" })).toHaveTextContent("Offline");
  });

  it("does not show chase status in the first innings with no target", () => {
    render(<LiveScoringScreen {...baseProps} />);
    expect(screen.queryByLabelText("Chase status")).not.toBeInTheDocument();
  });

  it("shows chase status with runs required, balls remaining, and RRR in the second innings with a target", () => {
    render(<LiveScoringScreen {...baseProps} inningsNumber={2} target={150} />);
    expect(screen.getByLabelText("Chase status")).toHaveTextContent("Need 60 off 45 balls (8.00 RRR)");
  });

  it("announces the last ball outcome via a polite live region", () => {
    render(<LiveScoringScreen {...baseProps} />);
    const region = screen.getByText("Dot ball. 90 for 3.");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("shows the current scoring state", () => {
    render(<LiveScoringScreen {...baseProps} />);
    expect(screen.getByLabelText("Scoring state")).toHaveTextContent("ACTIVE");
  });

  it("clicking Score a ball calls onScoreBall", async () => {
    const user = userEvent.setup();
    const onScoreBall = vi.fn();
    render(<LiveScoringScreen {...baseProps} onScoreBall={onScoreBall} />);
    await user.click(screen.getByRole("button", { name: "Score a ball" }));
    expect(onScoreBall).toHaveBeenCalledOnce();
  });

  it("every UX-10 action is wired to its own callback", async () => {
    const user = userEvent.setup();
    const callbacks = {
      onRecordWicket: vi.fn(),
      onRecordExtra: vi.fn(),
      onUndoLast: vi.fn(),
      onPause: vi.fn(),
      onOpenBallByBall: vi.fn(),
      onOpenScorecard: vi.fn(),
      onReviewStrike: vi.fn(),
    };
    render(<LiveScoringScreen {...baseProps} {...callbacks} />);

    await user.click(screen.getByRole("button", { name: "Record a wicket" }));
    await user.click(screen.getByRole("button", { name: "Record an extra" }));
    await user.click(screen.getByRole("button", { name: "Undo last" }));
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("button", { name: "Open Ball-by-Ball" }));
    await user.click(screen.getByRole("button", { name: "Open Scorecard" }));
    await user.click(screen.getByRole("button", { name: "Review/override strike" }));

    for (const fn of Object.values(callbacks)) {
      expect(fn).toHaveBeenCalledOnce();
    }
  });
});
