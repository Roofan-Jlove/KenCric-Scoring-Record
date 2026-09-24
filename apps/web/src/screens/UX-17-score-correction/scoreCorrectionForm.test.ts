import { describe, expect, it } from "vitest";
import { canConfirmCorrection, describeCascade, type CascadeSummary, type CorrectionFormState } from "./scoreCorrectionForm";

const noCascade: CascadeSummary = { orphanedDeliveryCount: null, requiresContinuation: false, firstStrikeContinuityBreakIndex: null };

// AUD-005
describe("canConfirmCorrection -- reason requirement", () => {
  it("blocks a blank reason on a non-Final match", () => {
    const state: CorrectionFormState = { reason: "   ", isFinal: false, hasElevatedRole: false };
    const result = canConfirmCorrection(state);
    expect(result.outcome).toBe("blocked");
    if (result.outcome !== "blocked") throw new Error("unreachable");
    expect(result.reason).toBe("A reason is required for every correction");
  });

  it("allows a non-blank reason on a non-Final match with no elevated role needed", () => {
    const state: CorrectionFormState = { reason: "Fixed a mis-scored boundary", isFinal: false, hasElevatedRole: false };
    expect(canConfirmCorrection(state)).toEqual({ outcome: "allowed" });
  });
});

// BR-006 / §19.3
describe("canConfirmCorrection -- post-Final elevated role", () => {
  it("blocks a Final-match correction without an elevated role, even with a valid reason", () => {
    const state: CorrectionFormState = { reason: "Fixed a mis-scored boundary", isFinal: true, hasElevatedRole: false };
    const result = canConfirmCorrection(state);
    expect(result.outcome).toBe("blocked");
    if (result.outcome !== "blocked") throw new Error("unreachable");
    expect(result.reason).toContain("elevated role");
  });

  it("the reason-blank failure takes priority over the elevated-role failure -- states exactly what's required first", () => {
    const state: CorrectionFormState = { reason: "", isFinal: true, hasElevatedRole: false };
    const result = canConfirmCorrection(state);
    if (result.outcome !== "blocked") throw new Error("unreachable");
    expect(result.reason).toBe("A reason is required for every correction");
  });

  it("allows a Final-match correction with both a reason and an elevated role", () => {
    const state: CorrectionFormState = { reason: "Fixed a mis-scored boundary", isFinal: true, hasElevatedRole: true };
    expect(canConfirmCorrection(state)).toEqual({ outcome: "allowed" });
  });
});

describe("describeCascade", () => {
  it("reports no downstream changes when the cascade is empty", () => {
    expect(describeCascade(noCascade)).toEqual(["No downstream changes detected"]);
  });

  it("reports a strike-continuity break at a 1-based delivery number", () => {
    const summary: CascadeSummary = { ...noCascade, firstStrikeContinuityBreakIndex: 4 };
    expect(describeCascade(summary)).toContain("Strike continuity breaks at delivery 5");
  });

  it("reports an orphaned-delivery count", () => {
    const summary: CascadeSummary = { ...noCascade, orphanedDeliveryCount: 3 };
    expect(describeCascade(summary)).toContain("3 later deliveries are now outside the innings");
  });

  it("reports a requires-continuation case", () => {
    const summary: CascadeSummary = { ...noCascade, requiresContinuation: true };
    expect(describeCascade(summary)).toContain("The innings no longer ends here -- further deliveries are required");
  });

  it("reports all applicable lines together, not just the first", () => {
    const summary: CascadeSummary = { orphanedDeliveryCount: 2, requiresContinuation: false, firstStrikeContinuityBreakIndex: 0 };
    const lines = describeCascade(summary);
    expect(lines).toHaveLength(2);
  });
});
