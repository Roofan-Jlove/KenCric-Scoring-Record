import { describe, expect, it } from "vitest";
import { InMemoryMatchStore, type MatchRow } from "../src/commands/matches.js";
import { deriveBattingContext, InMemoryBattingStateStore } from "../src/validation/battingContext.js";

function seedMatch(store: InMemoryMatchStore, overrides: Partial<MatchRow> = {}): MatchRow {
  const row: MatchRow = {
    id: "match-1",
    organizationId: "org-1",
    originDeviceId: "device-1",
    claimStatus: "CLAIMED",
    homeTeamId: "team-A",
    awayTeamId: "team-B",
    homeXi: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"],
    awayXi: ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11"],
    format: "T20",
    oversAllotted: 20,
    conditionsProfile: null,
    conditionsProfileVersion: null,
    dlsTableVersion: null,
    rainMethod: "NONE",
    tossWinnerTeamId: null,
    tossDecision: null,
    venue: null,
    scheduledStart: null,
    matchTimezone: "Asia/Karachi",
    minOversForResult: null,
    state: "IN_PROGRESS",
    result: null,
    rowVersion: 1,
    createdAt: "2026-10-01T00:00:00Z",
    createdBy: "user-1",
    updatedAt: "2026-10-01T00:00:00Z",
    updatedBy: "user-1",
    ...overrides,
  };
  store.insert(row);
  return row;
}

describe("deriveBattingContext (TASK-0147)", () => {
  it("returns EMPTY_BATTING_CONTEXT when the innings has never been seeded", () => {
    const matchStore = new InMemoryMatchStore();
    seedMatch(matchStore);
    const battingState = new InMemoryBattingStateStore();

    const context = deriveBattingContext("match-1", "p1", "p2", matchStore, battingState);
    expect(context.battingXiPlayerIds.size).toBe(0);
    expect(context.notOutPlayerIds.size).toBe(0);
  });

  it("returns EMPTY_BATTING_CONTEXT when the match can't be found", () => {
    const matchStore = new InMemoryMatchStore();
    const battingState = new InMemoryBattingStateStore();
    battingState.seed("no-such-match", "team-A");

    const context = deriveBattingContext("no-such-match", "p1", "p2", matchStore, battingState);
    expect(context.battingXiPlayerIds.size).toBe(0);
  });

  it("returns EMPTY_BATTING_CONTEXT when the batting team's XI isn't a recognisable string[]", () => {
    const matchStore = new InMemoryMatchStore();
    seedMatch(matchStore, { homeXi: { notAnArray: true } });
    const battingState = new InMemoryBattingStateStore();
    battingState.seed("match-1", "team-A");

    const context = deriveBattingContext("match-1", "p1", "p2", matchStore, battingState);
    expect(context.battingXiPlayerIds.size).toBe(0);
  });

  it("derives battingXiPlayerIds from the seeded team's XI", () => {
    const matchStore = new InMemoryMatchStore();
    seedMatch(matchStore);
    const battingState = new InMemoryBattingStateStore();
    battingState.seed("match-1", "team-A");

    const context = deriveBattingContext("match-1", "p1", "p2", matchStore, battingState);
    expect(context.battingXiPlayerIds.has("p1")).toBe(true);
    expect(context.battingXiPlayerIds.has("q1")).toBe(false);
  });

  it("alreadyBattedPlayerIds includes the current striker/non-striker and all dismissed players", () => {
    const matchStore = new InMemoryMatchStore();
    seedMatch(matchStore);
    const battingState = new InMemoryBattingStateStore();
    battingState.seed("match-1", "team-A");
    battingState.recordDismissal("match-1", "p1");
    battingState.recordDismissal("match-1", "p2");

    const context = deriveBattingContext("match-1", "p3", "p4", matchStore, battingState);
    expect(context.alreadyBattedPlayerIds).toEqual(new Set(["p1", "p2", "p3", "p4"]));
  });

  it("notOutPlayerIds excludes only the accumulated dismissed set, not the current pair", () => {
    const matchStore = new InMemoryMatchStore();
    seedMatch(matchStore);
    const battingState = new InMemoryBattingStateStore();
    battingState.seed("match-1", "team-A");
    battingState.recordDismissal("match-1", "p1");

    const context = deriveBattingContext("match-1", "p3", "p4", matchStore, battingState);
    expect(context.notOutPlayerIds.has("p1")).toBe(false);
    expect(context.notOutPlayerIds.has("p3")).toBe(true);
    expect(context.notOutPlayerIds.has("p5")).toBe(true);
  });

  it("an incoming batter not yet dismissed or at the crease is a valid V8 incomingBatterId", () => {
    const matchStore = new InMemoryMatchStore();
    seedMatch(matchStore);
    const battingState = new InMemoryBattingStateStore();
    battingState.seed("match-1", "team-A");
    battingState.recordDismissal("match-1", "p1");

    const context = deriveBattingContext("match-1", "p3", "p4", matchStore, battingState);
    const incoming = "p5";
    const validIncoming = context.battingXiPlayerIds.has(incoming) && context.notOutPlayerIds.has(incoming) && !context.alreadyBattedPlayerIds.has(incoming);
    expect(validIncoming).toBe(true);
  });

  it("re-seeding resets dismissedPlayerIds to empty", () => {
    const matchStore = new InMemoryMatchStore();
    seedMatch(matchStore);
    const battingState = new InMemoryBattingStateStore();
    battingState.seed("match-1", "team-A");
    battingState.recordDismissal("match-1", "p1");

    battingState.seed("match-1", "team-B");
    const context = deriveBattingContext("match-1", "q1", "q2", matchStore, battingState);
    expect(context.alreadyBattedPlayerIds.has("p1")).toBe(false);
    expect(context.battingXiPlayerIds.has("q1")).toBe(true);
  });
});
