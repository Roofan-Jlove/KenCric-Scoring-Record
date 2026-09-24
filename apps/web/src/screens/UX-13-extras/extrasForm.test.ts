import { describe, expect, it } from "vitest";
import { consumesLegalBall, initialExtrasFormState, isTypeEnabled, validateSubmission, type ExtrasFormState } from "./extrasForm";

// BR-034/BR-035
describe("consumesLegalBall", () => {
  it("byes and leg-byes count as legal balls", () => {
    expect(consumesLegalBall("BYE")).toBe(true);
    expect(consumesLegalBall("LEG_BYE")).toBe(true);
  });

  it("wides and no-balls do not count as legal balls", () => {
    expect(consumesLegalBall("WIDE")).toBe(false);
    expect(consumesLegalBall("NO_BALL")).toBe(false);
  });

  it("penalty does not consume a legal ball by default", () => {
    expect(consumesLegalBall("PENALTY")).toBe(false);
  });
});

describe("isTypeEnabled", () => {
  it("a type in the enabled set is enabled", () => {
    expect(isTypeEnabled("WIDE", new Set(["WIDE", "BYE"]))).toBe(true);
  });

  it("a type not in the enabled set is disabled", () => {
    expect(isTypeEnabled("PENALTY", new Set(["WIDE", "BYE"]))).toBe(false);
  });
});

describe("validateSubmission", () => {
  it("rejects an unselected type", () => {
    const result = validateSubmission(initialExtrasFormState());
    expect(result.outcome).toBe("invalid");
  });

  it("accepts a valid non-penalty extra", () => {
    const state: ExtrasFormState = { type: "BYE", additionalRuns: 2, penaltyReason: "", penaltyRecipientSide: null };
    expect(validateSubmission(state)).toEqual({ outcome: "valid", state });
  });

  it("rejects a negative additional-runs value", () => {
    const state: ExtrasFormState = { type: "WIDE", additionalRuns: -1, penaltyReason: "", penaltyRecipientSide: null };
    expect(validateSubmission(state).outcome).toBe("invalid");
  });

  it("rejects a non-integer additional-runs value", () => {
    const state: ExtrasFormState = { type: "WIDE", additionalRuns: 1.5, penaltyReason: "", penaltyRecipientSide: null };
    expect(validateSubmission(state).outcome).toBe("invalid");
  });

  // BR-036
  it("rejects a penalty with a blank reason", () => {
    const state: ExtrasFormState = { type: "PENALTY", additionalRuns: 0, penaltyReason: "   ", penaltyRecipientSide: "BATTING" };
    const result = validateSubmission(state);
    expect(result.outcome).toBe("invalid");
    if (result.outcome !== "invalid") throw new Error("unreachable");
    expect(result.reason).toContain("reason");
  });

  it("rejects a penalty with no recipient side", () => {
    const state: ExtrasFormState = { type: "PENALTY", additionalRuns: 0, penaltyReason: "Deliberate obstruction", penaltyRecipientSide: null };
    expect(validateSubmission(state).outcome).toBe("invalid");
  });

  it("accepts a fully completed penalty", () => {
    const state: ExtrasFormState = {
      type: "PENALTY",
      additionalRuns: 0,
      penaltyReason: "Deliberate obstruction",
      penaltyRecipientSide: "BATTING",
    };
    expect(validateSubmission(state)).toEqual({ outcome: "valid", state });
  });
});
