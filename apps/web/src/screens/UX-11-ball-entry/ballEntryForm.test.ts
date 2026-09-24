import { describe, expect, it } from "vitest";
import { canSubmit, composeRunValue, deriveBallEntryState, requiresLightweightConfirm } from "./ballEntryForm";

describe("composeRunValue", () => {
  it("accepts a valid primary tap with no overthrow", () => {
    const result = composeRunValue(4, 0);
    expect(result).toEqual({ outcome: "valid", totalRuns: 4 });
  });

  it("composes a primary tap plus an overthrow add-on", () => {
    const result = composeRunValue(1, 4);
    expect(result).toEqual({ outcome: "valid", totalRuns: 5 });
  });

  it("accepts the boundary values 0 and 6", () => {
    expect(composeRunValue(0, 0)).toEqual({ outcome: "valid", totalRuns: 0 });
    expect(composeRunValue(6, 0)).toEqual({ outcome: "valid", totalRuns: 6 });
  });

  it("rejects a primary tap above 6", () => {
    const result = composeRunValue(7, 0);
    expect(result.outcome).toBe("invalid");
  });

  it("rejects a negative primary tap", () => {
    const result = composeRunValue(-1, 0);
    expect(result.outcome).toBe("invalid");
  });

  it("rejects a non-integer primary tap", () => {
    const result = composeRunValue(2.5, 0);
    expect(result.outcome).toBe("invalid");
  });

  it("rejects a negative overthrow add-on", () => {
    const result = composeRunValue(1, -1);
    expect(result.outcome).toBe("invalid");
  });

  it("rejects a non-integer overthrow add-on", () => {
    const result = composeRunValue(1, 2.5);
    expect(result.outcome).toBe("invalid");
  });
});

describe("requiresLightweightConfirm", () => {
  it("does not require confirmation at or below the threshold", () => {
    expect(requiresLightweightConfirm(4, 4)).toBe(false);
    expect(requiresLightweightConfirm(2, 4)).toBe(false);
  });

  it("requires confirmation above the threshold", () => {
    expect(requiresLightweightConfirm(5, 4)).toBe(true);
  });
});

describe("deriveBallEntryState / canSubmit", () => {
  const base = { isGuardrailModalOpen: false, justRecorded: false, undoAvailable: false };

  it("READY when nothing else applies", () => {
    expect(deriveBallEntryState(base)).toBe("READY");
  });

  it("UNDO_AVAILABLE when undo is available and nothing higher-priority applies", () => {
    expect(deriveBallEntryState({ ...base, undoAvailable: true })).toBe("UNDO_AVAILABLE");
  });

  it("JUST_RECORDED takes priority over UNDO_AVAILABLE", () => {
    expect(deriveBallEntryState({ ...base, undoAvailable: true, justRecorded: true })).toBe("JUST_RECORDED");
  });

  it("GUARDRAIL_BLOCKED takes priority over everything else", () => {
    expect(deriveBallEntryState({ ...base, justRecorded: true, isGuardrailModalOpen: true })).toBe("GUARDRAIL_BLOCKED");
  });

  // UX-11's own Validation: submission blocked only while a guardrail modal is open.
  it("canSubmit is false only when GUARDRAIL_BLOCKED", () => {
    expect(canSubmit("READY")).toBe(true);
    expect(canSubmit("JUST_RECORDED")).toBe(true);
    expect(canSubmit("UNDO_AVAILABLE")).toBe(true);
    expect(canSubmit("GUARDRAIL_BLOCKED")).toBe(false);
  });
});
