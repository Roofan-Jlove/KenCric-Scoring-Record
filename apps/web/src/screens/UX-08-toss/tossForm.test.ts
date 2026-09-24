import { describe, expect, it } from "vitest";
import {
  amendToss,
  attemptEdit,
  canConfirm,
  confirmToss,
  deriveInningsOrder,
  initialTossState,
} from "./tossForm";

describe("canConfirm / confirmToss", () => {
  it("Confirm is disabled with neither field set", () => {
    expect(canConfirm(initialTossState())).toBe(false);
  });

  it("Confirm is disabled with only the winner set", () => {
    expect(canConfirm({ winner: "A", decision: null, confirmed: false })).toBe(false);
  });

  it("Confirm is enabled once both fields are set", () => {
    expect(canConfirm({ winner: "A", decision: "BAT", confirmed: false })).toBe(true);
  });

  it("confirmToss rejects when a field is missing", () => {
    const result = confirmToss({ winner: "A", decision: null, confirmed: false });
    expect(result.outcome).toBe("rejected");
  });

  it("confirmToss succeeds and locks the state once both fields are set", () => {
    const result = confirmToss({ winner: "A", decision: "BAT", confirmed: false });
    expect(result.outcome).toBe("confirmed");
    if (result.outcome !== "confirmed") throw new Error("unreachable");
    expect(result.state.confirmed).toBe(true);
  });

  it("confirmToss rejects a second confirm attempt", () => {
    const result = confirmToss({ winner: "A", decision: "BAT", confirmed: true });
    expect(result.outcome).toBe("rejected");
  });
});

describe("deriveInningsOrder -- N-B2", () => {
  it("N-B2: Team A elects to bat -> A bats first, B is the chasing side", () => {
    expect(deriveInningsOrder("A", "BAT")).toEqual({ battingFirst: "A", chasingSide: "B" });
  });

  it("Team A elects to bowl -> B bats first, A is the chasing side", () => {
    expect(deriveInningsOrder("A", "BOWL")).toEqual({ battingFirst: "B", chasingSide: "A" });
  });

  it("Team B elects to bat -> B bats first, A is the chasing side", () => {
    expect(deriveInningsOrder("B", "BAT")).toEqual({ battingFirst: "B", chasingSide: "A" });
  });

  it("Team B elects to bowl -> A bats first, B is the chasing side", () => {
    expect(deriveInningsOrder("B", "BOWL")).toEqual({ battingFirst: "A", chasingSide: "B" });
  });
});

describe("attemptEdit / amendToss -- frozen toss requires a reasoned amendment", () => {
  it("an edit attempt is allowed when the toss isn't locked", () => {
    expect(attemptEdit(false)).toBe("allowed");
  });

  it("an edit attempt requires amendment once locked", () => {
    expect(attemptEdit(true)).toBe("requires-amendment");
  });

  it("amendToss rejects a blank reason", () => {
    const result = amendToss("B", "BOWL", "   ");
    expect(result.outcome).toBe("rejected");
  });

  it("amendToss succeeds with a non-blank reason and applies the new winner/decision", () => {
    const result = amendToss("B", "BOWL", "Original toss winner recorded incorrectly");
    expect(result.outcome).toBe("amended");
    if (result.outcome !== "amended") throw new Error("unreachable");
    expect(result.state).toEqual({ winner: "B", decision: "BOWL", confirmed: true });
  });
});
