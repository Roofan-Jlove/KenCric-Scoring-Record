import { describe, expect, it } from "vitest";
import {
  canConfirm,
  initialWicketFormState,
  missingFields,
  modeIsOffered,
  reasonModeNotOffered,
  requiredFieldsForMode,
  validDismissalModesFor,
  type WicketFormState,
} from "./wicketEntryForm";

describe("validDismissalModesFor -- mirrors shared/'s already-tested logic", () => {
  it("a normal legal delivery offers the full 8-mode set", () => {
    const modes = validDismissalModesFor("LEGAL", false);
    expect([...modes].sort()).toEqual(
      ["BOWLED", "CAUGHT", "HIT_BALL_TWICE", "HIT_WICKET", "LBW", "OBSTRUCTING_THE_FIELD", "RUN_OUT", "STUMPED"].sort(),
    );
  });

  // BR-033: on an active free hit, only run out / obstructing / hit the ball twice.
  it("a free hit restricts to run out / obstructing / hit the ball twice", () => {
    const modes = validDismissalModesFor("LEGAL", true);
    expect([...modes].sort()).toEqual(["HIT_BALL_TWICE", "OBSTRUCTING_THE_FIELD", "RUN_OUT"].sort());
  });

  // BR-032: a stumping is invalid off a no-ball.
  it("a no-ball does not offer stumped", () => {
    const modes = validDismissalModesFor("NO_BALL", false);
    expect(modes.has("STUMPED")).toBe(false);
    expect(modes.has("RUN_OUT")).toBe(true);
  });

  it("a wide does not offer bowled, caught, LBW, or hit wicket", () => {
    const modes = validDismissalModesFor("WIDE", false);
    expect(modes.has("BOWLED")).toBe(false);
    expect(modes.has("CAUGHT")).toBe(false);
    expect(modes.has("LBW")).toBe(false);
    expect(modes.has("HIT_WICKET")).toBe(false);
    expect(modes.has("STUMPED")).toBe(true);
  });

  it("a dead ball offers no dismissal modes", () => {
    expect(validDismissalModesFor("DEAD_BALL", false).size).toBe(0);
  });
});

describe("modeIsOffered -- TIMED_OUT/RETIRED_OUT bridge", () => {
  it("TIMED_OUT and RETIRED_OUT are always offered regardless of legality/free-hit", () => {
    expect(modeIsOffered("TIMED_OUT", "DEAD_BALL", false)).toBe(true);
    expect(modeIsOffered("RETIRED_OUT", "LEGAL", true)).toBe(true);
  });

  it("other modes follow validDismissalModesFor exactly", () => {
    expect(modeIsOffered("STUMPED", "NO_BALL", false)).toBe(false);
    expect(modeIsOffered("RUN_OUT", "NO_BALL", false)).toBe(true);
  });
});

describe("reasonModeNotOffered", () => {
  it("is null when the mode is offered", () => {
    expect(reasonModeNotOffered("RUN_OUT", "LEGAL", false)).toBeNull();
  });

  it("gives a one-line reason when not offered", () => {
    expect(reasonModeNotOffered("STUMPED", "NO_BALL", false)).toContain("no-ball");
    expect(reasonModeNotOffered("BOWLED", "LEGAL", true)).toContain("free hit");
  });
});

describe("requiredFieldsForMode", () => {
  it("caught requires a fielder", () => {
    expect(requiredFieldsForMode("CAUGHT")).toEqual(["fielderIds"]);
  });

  it("run out requires crossedBeforeDismissal", () => {
    expect(requiredFieldsForMode("RUN_OUT")).toEqual(["crossedBeforeDismissal"]);
  });

  it("bowled requires neither mode-specific field", () => {
    expect(requiredFieldsForMode("BOWLED")).toEqual([]);
  });
});

describe("missingFields / canConfirm", () => {
  const validBowled: WicketFormState = {
    mode: "BOWLED",
    outBatterId: "b1",
    endVacated: "STRIKER",
    fielderIds: [],
    crossedBeforeDismissal: null,
    incomingBatterId: "b3",
  };

  it("an empty state is missing at minimum the mode", () => {
    expect(missingFields(initialWicketFormState(), false)).toEqual([{ field: "mode", message: "Select a dismissal mode" }]);
  });

  it("a fully complete bowled dismissal has no missing fields", () => {
    expect(missingFields(validBowled, false)).toEqual([]);
    expect(canConfirm(validBowled, false)).toBe(true);
  });

  it("caught without a fielder is blocked with an inline error naming that field", () => {
    const state: WicketFormState = { ...validBowled, mode: "CAUGHT", fielderIds: [] };
    const missing = missingFields(state, false);
    expect(missing).toContainEqual({ field: "fielderIds", message: "Select the fielder" });
  });

  it("run out without crossedBeforeDismissal is blocked with an inline error naming that field", () => {
    const state: WicketFormState = { ...validBowled, mode: "RUN_OUT" };
    const missing = missingFields(state, false);
    expect(missing).toContainEqual({ field: "crossedBeforeDismissal", message: "Select whether the batters crossed" });
  });

  it("incoming batter is required unless the dismissal ends the innings", () => {
    const state: WicketFormState = { ...validBowled, incomingBatterId: null };
    expect(canConfirm(state, false)).toBe(false);
    expect(canConfirm(state, true)).toBe(true);
  });
});
