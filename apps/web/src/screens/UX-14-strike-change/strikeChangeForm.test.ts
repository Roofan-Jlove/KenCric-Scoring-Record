import { describe, expect, it } from "vitest";
import {
  cancelSwap,
  confirmOverride,
  initialStrikeChangeFormState,
  resetToAutoForNextDelivery,
  toggleSwap,
} from "./strikeChangeForm";

const positions = { strikerId: "b1", nonStrikerId: "b2" };

describe("toggleSwap / cancelSwap", () => {
  it("toggleSwap moves to PENDING_OVERRIDE without changing positions", () => {
    const state = toggleSwap(initialStrikeChangeFormState(positions));
    expect(state.status).toBe("PENDING_OVERRIDE");
    expect(state.positions).toEqual(positions);
  });

  it("cancelSwap returns to AUTO and clears any reason", () => {
    let state = toggleSwap(initialStrikeChangeFormState(positions));
    state = { ...state, reason: "typed but not confirmed" };
    const cancelled = cancelSwap(state);
    expect(cancelled.status).toBe("AUTO");
    expect(cancelled.reason).toBe("");
  });
});

// §14.5: requires a non-empty reason.
describe("confirmOverride", () => {
  it("rejects a blank reason", () => {
    const state = toggleSwap(initialStrikeChangeFormState(positions));
    const result = confirmOverride(state, "   ");
    expect(result.outcome).toBe("rejected");
  });

  it("swaps the current pair on a valid reason", () => {
    const state = toggleSwap(initialStrikeChangeFormState(positions));
    const result = confirmOverride(state, "Running mix-up correction");
    expect(result.outcome).toBe("overridden");
    if (result.outcome !== "overridden") throw new Error("unreachable");
    expect(result.state.positions).toEqual({ strikerId: "b2", nonStrikerId: "b1" });
    expect(result.state.status).toBe("OVERRIDDEN");
    expect(result.state.reason).toBe("Running mix-up correction");
  });

  it("trims the stored reason", () => {
    const state = toggleSwap(initialStrikeChangeFormState(positions));
    const result = confirmOverride(state, "  padded reason  ");
    if (result.outcome !== "overridden") throw new Error("unreachable");
    expect(result.state.reason).toBe("padded reason");
  });
});

// §14.5: "never sticky beyond the one delivery it targets."
describe("resetToAutoForNextDelivery", () => {
  it("returns to AUTO with the newly auto-derived positions, discarding the override", () => {
    const overriddenState = confirmOverride(toggleSwap(initialStrikeChangeFormState(positions)), "reason");
    if (overriddenState.outcome !== "overridden") throw new Error("unreachable");
    const nextAuto = { strikerId: "b3", nonStrikerId: "b1" };
    const result = resetToAutoForNextDelivery(overriddenState.state, nextAuto);
    expect(result.status).toBe("AUTO");
    expect(result.positions).toEqual(nextAuto);
    expect(result.reason).toBe("");
  });
});
