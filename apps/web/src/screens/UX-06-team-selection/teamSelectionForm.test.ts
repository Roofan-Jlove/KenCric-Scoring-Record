import { describe, expect, it } from "vitest";
import {
  addPlayer,
  canContinue,
  initialTeamSelectionState,
  removePlayer,
  resolveTeamSearchState,
  selectTeam,
  squadMeetsMinimum,
  swapSides,
  teamsAreDistinct,
  type Player,
  type Team,
} from "./teamSelectionForm";

const teamA: Team = { id: "team-A", name: "Riverside CC", isAdHoc: false };
const teamB: Team = { id: "team-B", name: "Harbour CC", isAdHoc: false };

describe("selectTeam / teamsAreDistinct", () => {
  it("selecting a first team succeeds", () => {
    const result = selectTeam(initialTeamSelectionState(), "A", teamA);
    expect(result.outcome).toBe("selected");
    if (result.outcome !== "selected") throw new Error("unreachable");
    expect(result.state.teamA).toEqual(teamA);
  });

  it("selecting a distinct second team succeeds", () => {
    const afterA = selectTeam(initialTeamSelectionState(), "A", teamA);
    if (afterA.outcome !== "selected") throw new Error("unreachable");
    const result = selectTeam(afterA.state, "B", teamB);
    expect(result.outcome).toBe("selected");
  });

  // UX-06's own Error handling: blocked immediately, not deferred to Continue.
  it("selecting the same team already on the other side is rejected immediately", () => {
    const afterA = selectTeam(initialTeamSelectionState(), "A", teamA);
    if (afterA.outcome !== "selected") throw new Error("unreachable");
    const result = selectTeam(afterA.state, "B", teamA);
    expect(result.outcome).toBe("rejected");
  });

  it("a rejected selection never mutates state -- teamsAreDistinct still holds trivially since B was never set", () => {
    const afterA = selectTeam(initialTeamSelectionState(), "A", teamA);
    if (afterA.outcome !== "selected") throw new Error("unreachable");
    selectTeam(afterA.state, "B", teamA); // rejected, result discarded
    expect(afterA.state.teamB).toBeNull();
  });

  it("teamsAreDistinct is trivially true with fewer than two teams selected", () => {
    expect(teamsAreDistinct(initialTeamSelectionState())).toBe(true);
  });
});

describe("swapSides", () => {
  it("swaps both teams and their squads together", () => {
    const player: Player = { id: "p1", name: "J. Smith", isAdHoc: false };
    const state = { teamA, teamB, squadA: [player], squadB: [] };
    const swapped = swapSides(state);
    expect(swapped.teamA).toEqual(teamB);
    expect(swapped.teamB).toEqual(teamA);
    expect(swapped.squadA).toEqual([]);
    expect(swapped.squadB).toEqual([player]);
  });
});

describe("addPlayer / removePlayer", () => {
  it("adds a player to the specified side only", () => {
    const player: Player = { id: "p1", name: "J. Smith", isAdHoc: true };
    const state = addPlayer(initialTeamSelectionState(), "A", player);
    expect(state.squadA).toEqual([player]);
    expect(state.squadB).toEqual([]);
  });

  it("removes a player by id", () => {
    const player: Player = { id: "p1", name: "J. Smith", isAdHoc: true };
    const withPlayer = addPlayer(initialTeamSelectionState(), "A", player);
    const withoutPlayer = removePlayer(withPlayer, "A", "p1");
    expect(withoutPlayer.squadA).toEqual([]);
  });
});

describe("squadMeetsMinimum / canContinue", () => {
  it("a squad below the required XI size does not meet the minimum", () => {
    expect(squadMeetsMinimum([{ id: "p1", name: "A", isAdHoc: false }], 11)).toBe(false);
  });

  it("Continue is disabled with no teams selected", () => {
    expect(canContinue(initialTeamSelectionState(), 11)).toBe(false);
  });

  it("Continue is enabled once both teams are distinct and both squads meet the minimum", () => {
    const squad = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, isAdHoc: false }));
    const state = { teamA, teamB, squadA: squad, squadB: squad.map((p) => ({ ...p, id: `b-${p.id}` })) };
    expect(canContinue(state, 11)).toBe(true);
  });

  it("Continue is disabled if only one squad meets the minimum", () => {
    const fullSquad = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, isAdHoc: false }));
    const state = { teamA, teamB, squadA: fullSquad, squadB: [] };
    expect(canContinue(state, 11)).toBe(false);
  });
});

describe("resolveTeamSearchState", () => {
  const teams: Team[] = [teamA];

  it("a successful fetch with results is populated, not from cache", () => {
    expect(resolveTeamSearchState(true, teams, [])).toEqual({ status: "populated", teams, isFromCache: false });
  });

  it("a successful fetch with zero teams is the empty state (offers ad-hoc create)", () => {
    expect(resolveTeamSearchState(true, [], [])).toEqual({ status: "empty" });
  });

  it("a failed fetch falls back to cache when one exists (offline behavior)", () => {
    expect(resolveTeamSearchState(false, null, teams)).toEqual({ status: "fetch-failed-fallback-to-cache", teams });
  });

  it("a failed fetch with no cache is the no-cache state", () => {
    expect(resolveTeamSearchState(false, null, [])).toEqual({ status: "fetch-failed-no-cache" });
  });
});
