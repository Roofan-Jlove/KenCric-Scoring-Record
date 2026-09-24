import { describe, expect, it } from "vitest";
import {
  applyGuardrailOverlay,
  attemptUndo,
  canRedo,
  canUndo,
  deriveBaseState,
  onNewEntryRecorded,
  performRedo,
  performUndo,
} from "./undoRedoState";

describe("deriveBaseState / canUndo", () => {
  it("Undo is unavailable with no recent action", () => {
    expect(canUndo(deriveBaseState(false))).toBe(false);
  });

  it("Undo is available with a recent action", () => {
    expect(canUndo(deriveBaseState(true))).toBe(true);
  });
});

describe("applyGuardrailOverlay", () => {
  it("overrides to GUARDRAIL_DISABLED regardless of the underlying state", () => {
    const state = applyGuardrailOverlay(deriveBaseState(true), true);
    expect(state.status).toBe("GUARDRAIL_DISABLED");
    expect(canUndo(state)).toBe(false);
  });

  it("passes the underlying state through when no guardrail modal is open", () => {
    const state = applyGuardrailOverlay(deriveBaseState(true), false);
    expect(state.status).toBe("AVAILABLE");
  });
});

describe("performUndo / canRedo / performRedo", () => {
  it("performUndo moves AVAILABLE to JUST_UNDONE, capturing the undone action", () => {
    const state = performUndo(deriveBaseState(true), { delivery: "last-one" });
    expect(state.status).toBe("JUST_UNDONE");
    if (state.status !== "JUST_UNDONE") throw new Error("unreachable");
    expect(state.redoPayload).toEqual({ delivery: "last-one" });
  });

  it("performUndo is a no-op when not AVAILABLE", () => {
    const unavailable = deriveBaseState(false);
    expect(performUndo(unavailable, "x")).toBe(unavailable);
  });

  // Redo is available only immediately after an Undo.
  it("canRedo is false before any Undo has occurred", () => {
    expect(canRedo(deriveBaseState(true))).toBe(false);
  });

  it("canRedo is true immediately after Undo", () => {
    const undone = performUndo(deriveBaseState(true), "last-action");
    expect(canRedo(undone)).toBe(true);
  });

  it("performRedo restores the undone action and returns to AVAILABLE", () => {
    const undone = performUndo(deriveBaseState(true), "last-action");
    const result = performRedo(undone);
    expect(result).toEqual({ outcome: "redone", payload: "last-action", nextState: { status: "AVAILABLE" } });
  });

  it("performRedo is unavailable outside the JUST_UNDONE state", () => {
    const result = performRedo(deriveBaseState(true));
    expect(result).toEqual({ outcome: "unavailable" });
  });
});

// "Redo is available only... before any new entry."
describe("onNewEntryRecorded", () => {
  it("closes the redo window, returning to AVAILABLE", () => {
    const undone = performUndo(deriveBaseState(true), "last-action");
    const afterNewEntry = onNewEntryRecorded();
    expect(afterNewEntry).toEqual({ status: "AVAILABLE" });
    expect(canRedo(afterNewEntry)).toBe(false);
    expect(canRedo(undone)).toBe(true); // the prior state object is untouched
  });
});

describe("attemptUndo", () => {
  it("reverses cleanly when the action can be fully reversed", () => {
    expect(attemptUndo(true)).toEqual({ outcome: "reversed" });
  });

  it("routes to Score Correction with an explanation when it cannot", () => {
    const result = attemptUndo(false);
    expect(result.outcome).toBe("route-to-correction");
    if (result.outcome !== "route-to-correction") throw new Error("unreachable");
    expect(result.reason).toContain("Score Correction");
  });
});
