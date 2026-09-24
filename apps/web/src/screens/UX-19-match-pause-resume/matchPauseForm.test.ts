import { describe, expect, it } from "vitest";
import { confirmPause, confirmResume, initialMatchPauseState, pauseAnnouncement, type PauseReason } from "./matchPauseForm";

const drinks: PauseReason = { type: "PRESET", preset: "DRINKS" };

describe("confirmPause -- 'A reason is required to pause'", () => {
  it("pauses successfully with a preset reason", () => {
    const result = confirmPause(initialMatchPauseState(), drinks, 1000);
    expect(result.outcome).toBe("paused");
    if (result.outcome !== "paused") throw new Error("unreachable");
    expect(result.state.status).toBe("PAUSED");
    expect(result.state.activePause).toEqual({ reason: drinks, startTime: 1000, endTime: null });
  });

  it("pauses successfully with non-blank free-text 'Other' reason", () => {
    const reason: PauseReason = { type: "OTHER", text: "Power outage" };
    const result = confirmPause(initialMatchPauseState(), reason, 1000);
    expect(result.outcome).toBe("paused");
  });

  it("rejects a blank free-text 'Other' reason", () => {
    const reason: PauseReason = { type: "OTHER", text: "   " };
    const result = confirmPause(initialMatchPauseState(), reason, 1000);
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.reason).toBe("A reason is required to pause");
  });

  it("rejects pausing when not currently active (already paused)", () => {
    const paused = confirmPause(initialMatchPauseState(), drinks, 1000);
    if (paused.outcome !== "paused") throw new Error("unreachable");
    const secondAttempt = confirmPause(paused.state, drinks, 2000);
    expect(secondAttempt.outcome).toBe("rejected");
  });
});

describe("confirmResume -- 'Resume requires an active pause'", () => {
  it("rejects resuming from the active (non-paused) state", () => {
    const result = confirmResume(initialMatchPauseState(), 1000);
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.reason).toBe("Resume requires an active pause");
  });

  it("resumes successfully from an active pause, recording the end time", () => {
    const paused = confirmPause(initialMatchPauseState(), drinks, 1000);
    if (paused.outcome !== "paused") throw new Error("unreachable");
    const result = confirmResume(paused.state, 5000);
    expect(result.outcome).toBe("resumed");
    if (result.outcome !== "resumed") throw new Error("unreachable");
    expect(result.state).toEqual({ status: "ACTIVE", activePause: null });
    expect(result.record).toEqual({ reason: drinks, startTime: 1000, endTime: 5000 });
  });

  it("an accidental pause has an immediate, no-penalty Resume -- no cooldown enforced", () => {
    const paused = confirmPause(initialMatchPauseState(), drinks, 1000);
    if (paused.outcome !== "paused") throw new Error("unreachable");
    // Resume 1ms later -- still succeeds, no minimum-elapsed-time check.
    const result = confirmResume(paused.state, 1001);
    expect(result.outcome).toBe("resumed");
  });
});

describe("pauseAnnouncement", () => {
  it("announces a preset reason by its label", () => {
    expect(pauseAnnouncement(drinks)).toBe("Match paused: Drinks");
    expect(pauseAnnouncement({ type: "PRESET", preset: "RAIN" })).toBe("Match paused: Rain");
  });

  it("announces free-text 'Other' reasons verbatim", () => {
    expect(pauseAnnouncement({ type: "OTHER", text: "Power outage" })).toBe("Match paused: Power outage");
  });
});
