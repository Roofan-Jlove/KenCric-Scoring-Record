import { describe, expect, it } from "vitest";
import { InMemoryPlayerStore, type PlayerRow } from "../src/commands/players.js";
import { InMemoryPlayerAppearanceLookup, mergePlayers } from "../src/commands/mergePlayers.js";
import { InMemoryAuditLogStore } from "../src/commands/auditLog.js";

function seedPlayer(store: InMemoryPlayerStore, id: string, overrides: Partial<PlayerRow> = {}): PlayerRow {
  const row: PlayerRow = {
    id,
    organizationId: "org-1",
    name: id,
    dob: null,
    photoRef: null,
    status: "ACTIVE",
    mergedIntoPlayerId: null,
    rowVersion: 1,
    createdAt: "2026-10-01T00:00:00Z",
    createdBy: "admin-1",
    updatedAt: "2026-10-01T00:00:00Z",
    updatedBy: "admin-1",
    ...overrides,
  };
  store.insert(row);
  return row;
}

describe("mergePlayers (TASK-0121)", () => {
  it("merges a duplicate with no conflicting appearances", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    seedPlayer(store, "player-loser");
    const lookup = new InMemoryPlayerAppearanceLookup();
    lookup.seed("player-survivor", ["2026-09-01"]);
    lookup.seed("player-loser", ["2026-08-01"]);

    const result = mergePlayers("player-survivor", { losingPlayerId: "player-loser", reason: "duplicate registration" }, store, lookup, "admin-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("merged");
    if (result.outcome !== "merged") throw new Error("unreachable");
    expect(result.row.id).toBe("player-survivor");
    expect(result.row.status).toBe("ACTIVE");
  });

  it("marks the losing player MERGED with merged_into_player_id set", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    seedPlayer(store, "player-loser");
    const lookup = new InMemoryPlayerAppearanceLookup();

    mergePlayers("player-survivor", { losingPlayerId: "player-loser", reason: "duplicate" }, store, lookup, "admin-1", "2026-10-03T00:00:00Z", "req-1");

    const loser = store.get("player-loser");
    expect(loser?.status).toBe("MERGED");
    expect(loser?.mergedIntoPlayerId).toBe("player-survivor");
    expect(loser?.rowVersion).toBe(2);
  });

  it("does not modify the surviving player's own row", () => {
    const store = new InMemoryPlayerStore();
    const survivor = seedPlayer(store, "player-survivor");
    seedPlayer(store, "player-loser");
    const lookup = new InMemoryPlayerAppearanceLookup();

    mergePlayers("player-survivor", { losingPlayerId: "player-loser", reason: "duplicate" }, store, lookup, "admin-1", "2026-10-03T00:00:00Z", "req-1");

    expect(store.get("player-survivor")).toEqual(survivor);
  });

  it("missing losingPlayerId is a schema failure (400)", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    const result = mergePlayers("player-survivor", { reason: "duplicate" }, store, new InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing reason is a schema failure (400)", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    seedPlayer(store, "player-loser");
    const result = mergePlayers("player-survivor", { losingPlayerId: "player-loser" }, store, new InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("merging a player into itself is a business-rule failure (422)", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-1");
    const result = mergePlayers("player-1", { losingPlayerId: "player-1", reason: "oops" }, store, new InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });

  it("404s on an unknown surviving player id", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-loser");
    const result = mergePlayers("no-such-player", { losingPlayerId: "player-loser", reason: "duplicate" }, store, new InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("404s on an unknown losing player id", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    const result = mergePlayers("player-survivor", { losingPlayerId: "no-such-player", reason: "duplicate" }, store, new InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("rejects merging into an already-merged surviving player (409)", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor", { status: "MERGED", mergedIntoPlayerId: "player-ultimate" });
    seedPlayer(store, "player-loser");
    const result = mergePlayers("player-survivor", { losingPlayerId: "player-loser", reason: "duplicate" }, store, new InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("rejects merging an already-merged losing player again (409)", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    seedPlayer(store, "player-loser", { status: "MERGED", mergedIntoPlayerId: "player-other" });
    const result = mergePlayers("player-survivor", { losingPlayerId: "player-loser", reason: "duplicate" }, store, new InMemoryPlayerAppearanceLookup(), "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("rejects a merge with overlapping appearance dates, naming the conflicting dates (422)", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    seedPlayer(store, "player-loser");
    const lookup = new InMemoryPlayerAppearanceLookup();
    lookup.seed("player-survivor", ["2026-09-01", "2026-09-15"]);
    lookup.seed("player-loser", ["2026-09-15", "2026-09-20"]);

    const result = mergePlayers("player-survivor", { losingPlayerId: "player-loser", reason: "duplicate" }, store, lookup, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
    expect(result.problem.detail).toContain("2026-09-15");
  });

  it("does not mutate the losing player's row when rejected for a date conflict", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    const loser = seedPlayer(store, "player-loser");
    const lookup = new InMemoryPlayerAppearanceLookup();
    lookup.seed("player-survivor", ["2026-09-15"]);
    lookup.seed("player-loser", ["2026-09-15"]);

    mergePlayers("player-survivor", { losingPlayerId: "player-loser", reason: "duplicate" }, store, lookup, "admin-1", "now", "req-1");

    expect(store.get("player-loser")).toEqual(loser);
  });
});

describe("audit_log wiring (TASK-0146)", () => {
  it("a successful merge writes a PLAYER_MERGE row when auditLog is passed", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    seedPlayer(store, "player-loser");
    const lookup = new InMemoryPlayerAppearanceLookup();
    const auditLogStore = new InMemoryAuditLogStore();

    mergePlayers("player-survivor", { losingPlayerId: "player-loser", reason: "duplicate registration" }, store, lookup, "admin-1", "2026-10-05T00:00:00Z", "req-1", {
      store: auditLogStore,
      newId: "audit-1",
    });

    const rows = auditLogStore.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("PLAYER_MERGE");
    expect(rows[0].action).toBe("MERGE");
    expect(rows[0].targetRef).toBe("player-survivor");
    expect(rows[0].reason).toBe("duplicate registration");
  });

  it("with no auditLog passed, no row is written (today's behavior, unchanged)", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    seedPlayer(store, "player-loser");
    const lookup = new InMemoryPlayerAppearanceLookup();

    const result = mergePlayers("player-survivor", { losingPlayerId: "player-loser", reason: "duplicate" }, store, lookup, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("merged");
  });

  it("a rejected merge writes no audit row", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, "player-survivor");
    const lookup = new InMemoryPlayerAppearanceLookup();
    const auditLogStore = new InMemoryAuditLogStore();

    const result = mergePlayers("player-survivor", { losingPlayerId: "no-such-player", reason: "x" }, store, lookup, "admin-1", "now", "req-1", { store: auditLogStore, newId: "audit-1" });
    expect(result.outcome).toBe("rejected");
    expect(auditLogStore.list()).toHaveLength(0);
  });
});
