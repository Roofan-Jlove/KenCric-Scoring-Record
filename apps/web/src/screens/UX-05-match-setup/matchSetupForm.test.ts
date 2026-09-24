import { describe, expect, it } from "vitest";
import {
  canContinue,
  initialMatchSetupState,
  mustHaveChecklist,
  validateAll,
  validateBowlerOverCap,
  validateMatchTimezone,
  validateMinOversForResult,
  validateOversAllotted,
  validatePowerplayOvers,
  type MatchSetupFormState,
} from "./matchSetupForm";

function state(overrides: Partial<MatchSetupFormState> = {}): MatchSetupFormState {
  return { ...initialMatchSetupState(), ...overrides };
}

describe("validateOversAllotted (B-B1)", () => {
  it("rejects when absent", () => {
    expect(validateOversAllotted(state())).not.toBeNull();
  });

  // B-B1: the smallest positive integer is accepted.
  it("accepts overs_allotted = 1", () => {
    expect(validateOversAllotted(state({ oversAllotted: 1 }))).toBeNull();
  });

  // B-B1: overs_allotted = 0 is rejected.
  it("rejects overs_allotted = 0", () => {
    expect(validateOversAllotted(state({ oversAllotted: 0 }))).not.toBeNull();
  });

  it("rejects a non-integer", () => {
    expect(validateOversAllotted(state({ oversAllotted: 2.5 }))).not.toBeNull();
  });
});

describe("validateMatchTimezone", () => {
  it("rejects when absent -- UX-05's own text: 'time zone required'", () => {
    expect(validateMatchTimezone(state())).not.toBeNull();
  });

  it("accepts a non-empty value", () => {
    expect(validateMatchTimezone(state({ matchTimezone: "Asia/Karachi" }))).toBeNull();
  });
});

describe("validatePowerplayOvers (I-B1)", () => {
  it("no error when absent -- powerplay is optional", () => {
    expect(validatePowerplayOvers(state({ oversAllotted: 20 }))).toEqual([]);
  });

  // I-B1's exact case: powerplayOvers > oversAllotted flags BOTH fields.
  it("flags both fields when powerplayOvers exceeds oversAllotted", () => {
    const errors = validatePowerplayOvers(state({ oversAllotted: 10, powerplayOvers: 15 }));
    const fields = errors.map((e) => e.field);
    expect(fields).toContain("powerplayOvers");
    expect(fields).toContain("oversAllotted");
  });

  it("no error when powerplayOvers is within oversAllotted", () => {
    expect(validatePowerplayOvers(state({ oversAllotted: 20, powerplayOvers: 6 }))).toEqual([]);
  });

  it("equal to oversAllotted is not an over-limit violation", () => {
    const errors = validatePowerplayOvers(state({ oversAllotted: 20, powerplayOvers: 20 }));
    expect(errors).toEqual([]);
  });
});

describe("validateBowlerOverCap", () => {
  it("flags both fields when the cap exceeds oversAllotted, same shape as powerplay", () => {
    const errors = validateBowlerOverCap(state({ oversAllotted: 20, bowlerOverCap: 25 }));
    const fields = errors.map((e) => e.field);
    expect(fields).toContain("bowlerOverCap");
    expect(fields).toContain("oversAllotted");
  });

  it("no error when within bounds", () => {
    expect(validateBowlerOverCap(state({ oversAllotted: 20, bowlerOverCap: 4 }))).toEqual([]);
  });
});

describe("validateMinOversForResult", () => {
  it("flags both fields when it exceeds oversAllotted", () => {
    const errors = validateMinOversForResult(state({ oversAllotted: 20, minOversForResult: 25 }));
    expect(errors.map((e) => e.field)).toContain("minOversForResult");
  });

  it("no error when within bounds", () => {
    expect(validateMinOversForResult(state({ oversAllotted: 20, minOversForResult: 5 }))).toEqual([]);
  });
});

describe("mustHaveChecklist (BR-002)", () => {
  it("both items incomplete on a fresh form", () => {
    const checklist = mustHaveChecklist(state());
    expect(checklist.every((item) => !item.complete)).toBe(true);
  });

  it("both items complete once oversAllotted and matchTimezone are valid", () => {
    const checklist = mustHaveChecklist(state({ oversAllotted: 20, matchTimezone: "Asia/Karachi" }));
    expect(checklist.every((item) => item.complete)).toBe(true);
  });
});

describe("canContinue (N-B1)", () => {
  it("disabled on a fresh form", () => {
    expect(canContinue(state())).toBe(false);
  });

  it("enabled once Must-have fields are valid and no cross-field errors exist", () => {
    expect(canContinue(state({ oversAllotted: 20, matchTimezone: "Asia/Karachi" }))).toBe(true);
  });

  // N-B1 + I-B1 together: Must-have fields alone are not sufficient if
  // a cross-field rule is violated.
  it("disabled when Must-have fields are valid but a cross-field rule is violated", () => {
    expect(
      canContinue(state({ oversAllotted: 10, matchTimezone: "Asia/Karachi", powerplayOvers: 15 })),
    ).toBe(false);
  });

  it("validateAll aggregates every rule in one pass", () => {
    const errors = validateAll(state({ oversAllotted: 10, powerplayOvers: 15, bowlerOverCap: 12 }));
    const fields = errors.map((e) => e.field);
    expect(fields).toContain("matchTimezone");
    expect(fields).toContain("powerplayOvers");
    expect(fields).toContain("bowlerOverCap");
  });
});
