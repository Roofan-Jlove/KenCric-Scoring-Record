import { describe, expect, it } from "vitest";
import {
  canConfirm,
  confirmAndStart,
  initialInningsSetupState,
  selectBowler,
  selectNonStriker,
  selectStriker,
  swapEnds,
  type Player,
} from "./inningsSetupForm";

const battingXi: Player[] = [
  { id: "b1", name: "Alice" },
  { id: "b2", name: "Bea" },
];
const fieldingXi: Player[] = [{ id: "f1", name: "Cara" }];

describe("selectStriker / selectNonStriker", () => {
  it("selects a striker from the batting XI", () => {
    const result = selectStriker(initialInningsSetupState(), "b1", battingXi, "Team A");
    expect(result.outcome).toBe("selected");
    if (result.outcome !== "selected") throw new Error("unreachable");
    expect(result.state.strikerId).toBe("b1");
  });

  it("rejects a striker not in the batting XI", () => {
    const result = selectStriker(initialInningsSetupState(), "f1", battingXi, "Team A");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.reason).toContain("Team A");
  });

  // UX-09's own Error handling: blocked inline, not deferred to Confirm.
  it("rejects selecting the same player already chosen as non-striker", () => {
    const withNonStriker = { strikerId: null, nonStrikerId: "b2", bowlerId: null };
    const result = selectStriker(withNonStriker, "b2", battingXi, "Team A");
    expect(result.outcome).toBe("rejected");
  });

  it("rejects selecting the same player already chosen as striker, for non-striker", () => {
    const withStriker = { strikerId: "b1", nonStrikerId: null, bowlerId: null };
    const result = selectNonStriker(withStriker, "b1", battingXi, "Team A");
    expect(result.outcome).toBe("rejected");
  });

  it("a rejected selection never mutates state", () => {
    const withNonStriker = { strikerId: null, nonStrikerId: "b2", bowlerId: null };
    selectStriker(withNonStriker, "b2", battingXi, "Team A"); // rejected, result discarded
    expect(withNonStriker.strikerId).toBeNull();
  });
});

describe("selectBowler", () => {
  it("selects a bowler from the fielding XI", () => {
    const result = selectBowler(initialInningsSetupState(), "f1", fieldingXi, "Team B");
    expect(result.outcome).toBe("selected");
  });

  // UX-09's own Error handling: names the correct side.
  it("rejects a bowler not in the fielding XI, naming the correct side", () => {
    const result = selectBowler(initialInningsSetupState(), "b1", fieldingXi, "Team B");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.reason).toContain("Team B");
  });
});

describe("swapEnds", () => {
  it("swaps striker and non-striker", () => {
    const state = { strikerId: "b1", nonStrikerId: "b2", bowlerId: "f1" };
    const swapped = swapEnds(state);
    expect(swapped.strikerId).toBe("b2");
    expect(swapped.nonStrikerId).toBe("b1");
    expect(swapped.bowlerId).toBe("f1");
  });
});

describe("canConfirm / confirmAndStart", () => {
  it("Confirm is disabled with no roles set", () => {
    expect(canConfirm(initialInningsSetupState())).toBe(false);
  });

  it("Confirm is disabled with only two of three roles set", () => {
    expect(canConfirm({ strikerId: "b1", nonStrikerId: "b2", bowlerId: null })).toBe(false);
  });

  it("Confirm is enabled once all three roles are set", () => {
    expect(canConfirm({ strikerId: "b1", nonStrikerId: "b2", bowlerId: "f1" })).toBe(true);
  });

  it("confirmAndStart rejects an incomplete state", () => {
    const result = confirmAndStart(initialInningsSetupState());
    expect(result.outcome).toBe("rejected");
  });

  it("confirmAndStart succeeds once complete", () => {
    const state = { strikerId: "b1", nonStrikerId: "b2", bowlerId: "f1" };
    const result = confirmAndStart(state);
    expect(result.outcome).toBe("started");
    if (result.outcome !== "started") throw new Error("unreachable");
    expect(result.state).toEqual(state);
  });
});
