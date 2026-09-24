import { describe, expect, it } from "vitest";
import {
  addAdHocPlayer,
  canContinue,
  findDuplicatePlayerId,
  initialSideXiState,
  setCaptain,
  setKeeper,
  sideIsValid,
  sideValidationIssues,
  togglePlayer,
  type Player,
} from "./playingXiForm";

function squadOf(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, isAdHoc: false }));
}

describe("togglePlayer", () => {
  it("toggling a player on adds them to selectedIds", () => {
    const state = initialSideXiState(squadOf(11));
    const result = togglePlayer(state, "p0", 11);
    expect(result.outcome).toBe("toggled");
    if (result.outcome !== "toggled") throw new Error("unreachable");
    expect(result.state.selectedIds).toEqual(["p0"]);
  });

  // UX-07's own Error handling: blocked at the moment of the extra tap, not deferred to Continue.
  it("toggling on past the required XI size is blocked immediately", () => {
    const squad = squadOf(2);
    let state = initialSideXiState(squad);
    const first = togglePlayer(state, "p0", 1);
    if (first.outcome !== "toggled") throw new Error("unreachable");
    state = first.state;
    const second = togglePlayer(state, "p1", 1);
    expect(second.outcome).toBe("blocked");
    if (second.outcome !== "blocked") throw new Error("unreachable");
    expect(second.reason).toBe("XI is full — remove someone first");
  });

  it("blocking never mutates state -- still 1 of 1 selected after a blocked toggle", () => {
    const squad = squadOf(2);
    const first = togglePlayer(initialSideXiState(squad), "p0", 1);
    if (first.outcome !== "toggled") throw new Error("unreachable");
    togglePlayer(first.state, "p1", 1); // blocked, result discarded
    expect(first.state.selectedIds).toEqual(["p0"]);
  });

  it("toggling off removes the player and clears captain/keeper if they held either role", () => {
    let state = initialSideXiState(squadOf(2));
    state = (togglePlayer(state, "p0", 2) as { outcome: "toggled"; state: typeof state }).state;
    state = (setCaptain(state, "p0") as { outcome: "set"; state: typeof state }).state;
    state = (setKeeper(state, "p0") as { outcome: "set"; state: typeof state }).state;
    const removed = togglePlayer(state, "p0", 2);
    expect(removed.outcome).toBe("toggled");
    if (removed.outcome !== "toggled") throw new Error("unreachable");
    expect(removed.state.selectedIds).toEqual([]);
    expect(removed.state.captainId).toBeNull();
    expect(removed.state.keeperId).toBeNull();
  });
});

describe("setCaptain / setKeeper", () => {
  it("rejects marking a captain who isn't selected in the XI", () => {
    const state = initialSideXiState(squadOf(2));
    const result = setCaptain(state, "p0");
    expect(result.outcome).toBe("rejected");
  });

  it("marking a second captain replaces the first -- I-C2 satisfied structurally", () => {
    let state = initialSideXiState(squadOf(2));
    state = (togglePlayer(state, "p0", 2) as { outcome: "toggled"; state: typeof state }).state;
    state = (togglePlayer(state, "p1", 2) as { outcome: "toggled"; state: typeof state }).state;
    state = (setCaptain(state, "p0") as { outcome: "set"; state: typeof state }).state;
    state = (setCaptain(state, "p1") as { outcome: "set"; state: typeof state }).state;
    expect(state.captainId).toBe("p1");
  });
});

describe("addAdHocPlayer", () => {
  it("adds to the squad and immediately into the XI", () => {
    const state = initialSideXiState(squadOf(1));
    const result = addAdHocPlayer(state, "J. Smith", 11, "adhoc-1");
    expect(result.outcome).toBe("added");
    if (result.outcome !== "added") throw new Error("unreachable");
    expect(result.state.squad).toHaveLength(2);
    expect(result.state.selectedIds).toContain("adhoc-1");
  });

  it("is blocked immediately if the XI is already full", () => {
    let state = initialSideXiState(squadOf(1));
    state = (togglePlayer(state, "p0", 1) as { outcome: "toggled"; state: typeof state }).state;
    const result = addAdHocPlayer(state, "J. Smith", 1, "adhoc-1");
    expect(result.outcome).toBe("blocked");
  });
});

describe("sideIsValid / sideValidationIssues -- N-C1 / B-C1", () => {
  it("N-C1: exactly 11 selected + 1 captain + 1 keeper is valid", () => {
    let state = initialSideXiState(squadOf(11));
    for (const p of state.squad) {
      state = (togglePlayer(state, p.id, 11) as { outcome: "toggled"; state: typeof state }).state;
    }
    state = (setCaptain(state, "p0") as { outcome: "set"; state: typeof state }).state;
    state = (setKeeper(state, "p1") as { outcome: "set"; state: typeof state }).state;
    expect(sideIsValid(state, 11)).toBe(true);
    expect(sideValidationIssues(state, "A", 11)).toEqual([]);
  });

  it("B-C1: exactly 11 selected + 0 keepers is blocked identifying 'wicket-keeper required'", () => {
    let state = initialSideXiState(squadOf(11));
    for (const p of state.squad) {
      state = (togglePlayer(state, p.id, 11) as { outcome: "toggled"; state: typeof state }).state;
    }
    state = (setCaptain(state, "p0") as { outcome: "set"; state: typeof state }).state;
    expect(sideIsValid(state, 11)).toBe(false);
    const issues = sideValidationIssues(state, "A", 11);
    expect(issues).toContainEqual({ side: "A", issue: "keeper", message: "Team A: wicket-keeper required" });
  });

  it("B-C1: exactly 11 selected + 1 keeper marked passes the keeper check", () => {
    let state = initialSideXiState(squadOf(11));
    for (const p of state.squad) {
      state = (togglePlayer(state, p.id, 11) as { outcome: "toggled"; state: typeof state }).state;
    }
    state = (setKeeper(state, "p0") as { outcome: "set"; state: typeof state }).state;
    const issues = sideValidationIssues(state, "A", 11);
    expect(issues.some((i) => i.issue === "keeper")).toBe(false);
  });
});

describe("findDuplicatePlayerId / canContinue -- I-C1", () => {
  it("I-C1: the same player_id selected in both sides' XIs is identified specifically", () => {
    let sideA = initialSideXiState(squadOf(1));
    sideA = (togglePlayer(sideA, "p0", 1) as { outcome: "toggled"; state: typeof sideA }).state;
    let sideB = initialSideXiState(squadOf(1));
    sideB = (togglePlayer(sideB, "p0", 1) as { outcome: "toggled"; state: typeof sideB }).state;
    expect(findDuplicatePlayerId({ sideA, sideB })).toBe("p0");
  });

  it("canContinue is false while a duplicate player_id exists across both sides, even if both sides are otherwise valid", () => {
    let sideA = initialSideXiState(squadOf(1));
    sideA = (togglePlayer(sideA, "p0", 1) as { outcome: "toggled"; state: typeof sideA }).state;
    sideA = (setCaptain(sideA, "p0") as { outcome: "set"; state: typeof sideA }).state;
    sideA = (setKeeper(sideA, "p0") as { outcome: "set"; state: typeof sideA }).state;
    let sideB = initialSideXiState(squadOf(1));
    sideB = (togglePlayer(sideB, "p0", 1) as { outcome: "toggled"; state: typeof sideB }).state;
    sideB = (setCaptain(sideB, "p0") as { outcome: "set"; state: typeof sideB }).state;
    sideB = (setKeeper(sideB, "p0") as { outcome: "set"; state: typeof sideB }).state;
    expect(canContinue({ sideA, sideB }, 1)).toBe(false);
  });

  it("canContinue is true once both sides are valid and no duplicate exists", () => {
    let sideA = initialSideXiState(squadOf(1));
    sideA = (togglePlayer(sideA, "p0", 1) as { outcome: "toggled"; state: typeof sideA }).state;
    sideA = (setCaptain(sideA, "p0") as { outcome: "set"; state: typeof sideA }).state;
    sideA = (setKeeper(sideA, "p0") as { outcome: "set"; state: typeof sideA }).state;
    let sideB = initialSideXiState([{ id: "q0", name: "Q0", isAdHoc: false }]);
    sideB = (togglePlayer(sideB, "q0", 1) as { outcome: "toggled"; state: typeof sideB }).state;
    sideB = (setCaptain(sideB, "q0") as { outcome: "set"; state: typeof sideB }).state;
    sideB = (setKeeper(sideB, "q0") as { outcome: "set"; state: typeof sideB }).state;
    expect(canContinue({ sideA, sideB }, 1)).toBe(true);
  });
});
