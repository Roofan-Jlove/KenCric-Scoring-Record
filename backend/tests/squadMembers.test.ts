import { describe, expect, it } from "vitest";
import { addSquadMember, getSquadMember, InMemorySquadMemberStore, listSquadMembers, removeSquadMember } from "../src/commands/squadMembers.js";

describe("addSquadMember (TASK-0097)", () => {
  it("a valid add creates the row with server-assigned provenance", () => {
    const store = new InMemorySquadMemberStore();
    const result = addSquadMember("team-1", "player-1", "wicketkeeper-batter", store, "user-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("added");
    if (result.outcome !== "added") throw new Error("unreachable");
    expect(result.row.roleHint).toBe("wicketkeeper-batter");
    expect(result.row.createdBy).toBe("user-1");
    expect(result.row.createdAt).toBe("2026-10-03T00:00:00Z");
  });

  it("roleHint is optional and defaults to null", () => {
    const store = new InMemorySquadMemberStore();
    const result = addSquadMember("team-1", "player-1", undefined, store, "user-1", "now", "req-1");
    if (result.outcome !== "added") throw new Error("unreachable");
    expect(result.row.roleHint).toBeNull();
  });

  it("a missing teamId is a schema failure (400)", () => {
    const store = new InMemorySquadMemberStore();
    const result = addSquadMember("", "player-1", null, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("a missing playerId is a schema failure (400)", () => {
    const store = new InMemorySquadMemberStore();
    const result = addSquadMember("team-1", "", null, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("is idempotent -- re-adding the same pair never 409s, and preserves original createdAt/createdBy", () => {
    const store = new InMemorySquadMemberStore();
    addSquadMember("team-1", "player-1", "opener", store, "user-1", "2026-10-03T00:00:00Z", "req-1");
    const result = addSquadMember("team-1", "player-1", "middle-order", store, "user-2", "2026-10-03T05:00:00Z", "req-2");

    expect(result.outcome).toBe("added");
    if (result.outcome !== "added") throw new Error("unreachable");
    expect(result.row.roleHint).toBe("middle-order");
    expect(result.row.createdBy).toBe("user-1");
    expect(result.row.createdAt).toBe("2026-10-03T00:00:00Z");
  });

  it("the same player may belong to different teams' squads independently", () => {
    const store = new InMemorySquadMemberStore();
    addSquadMember("team-1", "player-1", "opener", store, "user-1", "now", "req-1");
    const result = addSquadMember("team-2", "player-1", "bowler", store, "user-1", "now", "req-2");
    expect(result.outcome).toBe("added");
    expect(store.get("team-1", "player-1")?.roleHint).toBe("opener");
  });
});

describe("getSquadMember (TASK-0097)", () => {
  it("returns the row when it exists", () => {
    const store = new InMemorySquadMemberStore();
    addSquadMember("team-1", "player-1", null, store, "user-1", "now", "req-1");
    expect(getSquadMember("team-1", "player-1", store, "req-1").outcome).toBe("found");
  });

  it("404s when the pair does not exist", () => {
    const store = new InMemorySquadMemberStore();
    const result = getSquadMember("team-1", "no-such-player", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listSquadMembers (TASK-0097)", () => {
  it("lists only the given team's squad, scoped by the path's own implicit filter", () => {
    const store = new InMemorySquadMemberStore();
    addSquadMember("team-1", "player-1", null, store, "user-1", "now", "req-1");
    addSquadMember("team-1", "player-2", null, store, "user-1", "now", "req-1");
    addSquadMember("team-2", "player-3", null, store, "user-1", "now", "req-1");

    const result = listSquadMembers("team-1", store);
    expect(result.map((r) => r.playerId).sort()).toEqual(["player-1", "player-2"]);
  });

  it("an empty squad returns an empty list, not an error", () => {
    const store = new InMemorySquadMemberStore();
    expect(listSquadMembers("team-1", store)).toEqual([]);
  });
});

describe("removeSquadMember (TASK-0097)", () => {
  it("removes the pair outright, no gate", () => {
    const store = new InMemorySquadMemberStore();
    addSquadMember("team-1", "player-1", null, store, "user-1", "now", "req-1");
    const result = removeSquadMember("team-1", "player-1", store, "req-1");
    expect(result.outcome).toBe("removed");
    expect(store.get("team-1", "player-1")).toBeNull();
  });

  it("404s when the pair does not exist", () => {
    const store = new InMemorySquadMemberStore();
    const result = removeSquadMember("team-1", "no-such-player", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("removing one team's entry never affects the same player's squad membership on another team", () => {
    const store = new InMemorySquadMemberStore();
    addSquadMember("team-1", "player-1", null, store, "user-1", "now", "req-1");
    addSquadMember("team-2", "player-1", null, store, "user-1", "now", "req-1");
    removeSquadMember("team-1", "player-1", store, "req-1");
    expect(store.get("team-2", "player-1")).not.toBeNull();
  });
});
