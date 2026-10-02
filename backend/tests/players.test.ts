import { describe, expect, it } from "vitest";
import {
  createPlayer,
  getPlayer,
  InMemoryPlayerStore,
  listPlayers,
  updatePlayer,
  type CreatePlayerPayload,
  type UpdatePlayerPayload,
} from "../src/commands/players.js";

function validPayload(overrides: Partial<CreatePlayerPayload> = {}): Partial<CreatePlayerPayload> {
  return {
    id: "player-1",
    organizationId: "org-1",
    name: "Alex Rivera",
    ...overrides,
  };
}

function seedPlayer(store: InMemoryPlayerStore, overrides: Partial<CreatePlayerPayload> = {}) {
  const result = createPlayer(validPayload(overrides), store, "user-1", "2026-10-03T00:00:00Z", "req-seed");
  if (result.outcome !== "created") throw new Error("seed failed");
  return result.row;
}

describe("createPlayer (TASK-0096)", () => {
  it("a valid payload creates the row, always ACTIVE and unmerged, with server-assigned audit fields", () => {
    const store = new InMemoryPlayerStore();
    const result = createPlayer(validPayload(), store, "user-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.status).toBe("ACTIVE");
    expect(result.row.mergedIntoPlayerId).toBeNull();
    expect(result.row.dob).toBeNull();
    expect(result.row.rowVersion).toBe(1);
    expect(result.row.createdBy).toBe("user-1");
  });

  it("a null organizationId creates a purely local/ad-hoc player", () => {
    const store = new InMemoryPlayerStore();
    const result = createPlayer(validPayload({ organizationId: null }), store, "user-1", "now", "req-1");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.organizationId).toBeNull();
  });

  it("accepts optional dob and photoRef", () => {
    const store = new InMemoryPlayerStore();
    const result = createPlayer(validPayload({ dob: "2010-05-01", photoRef: "photo-1" }), store, "user-1", "now", "req-1");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.dob).toBe("2010-05-01");
    expect(result.row.photoRef).toBe("photo-1");
  });

  it("a missing name is a schema failure (400)", () => {
    const store = new InMemoryPlayerStore();
    const result = createPlayer({ id: "player-1" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("an id that already exists is rejected -- use the update path", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store);
    const result = createPlayer(validPayload(), store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
  });

  it("there is no way to set status or mergedIntoPlayerId through create -- the payload type has no such fields", () => {
    const store = new InMemoryPlayerStore();
    // @ts-expect-error -- status/mergedIntoPlayerId are intentionally not part of CreatePlayerPayload
    const payload: Partial<CreatePlayerPayload> = { id: "player-1", name: "Alex", status: "MERGED", mergedIntoPlayerId: "other" };
    const result = createPlayer(payload, store, "user-1", "now", "req-1");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.status).toBe("ACTIVE");
    expect(result.row.mergedIntoPlayerId).toBeNull();
  });
});

describe("updatePlayer (TASK-0096)", () => {
  it("a valid update with the current row_version succeeds and increments row_version by exactly 1", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store);
    const result = updatePlayer("player-1", { rowVersion: 1, name: "Alexandra Rivera" }, store, "user-2", "later", "req-1");
    expect(result.outcome).toBe("updated");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.name).toBe("Alexandra Rivera");
    expect(result.row.rowVersion).toBe(2);
  });

  it("only fields present in the payload change -- a partial update", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, { photoRef: "old-photo" });
    const result = updatePlayer("player-1", { rowVersion: 1, name: "New Name" }, store, "user-1", "later", "req-1");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.name).toBe("New Name");
    expect(result.row.photoRef).toBe("old-photo");
  });

  it("an update against a non-existent id is 404", () => {
    const store = new InMemoryPlayerStore();
    const result = updatePlayer("no-such-player", { rowVersion: 1 }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("a missing row_version is a schema failure (400)", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store);
    const result = updatePlayer("player-1", {} as UpdatePlayerPayload, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("a stale row_version is rejected 409, the stored row provably unchanged", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store);
    const result = updatePlayer("player-1", { rowVersion: 999, name: "Should not apply" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
    expect(store.get("player-1")?.name).toBe("Alex Rivera");
  });

  it("an empty name in the update payload is rejected", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store);
    const result = updatePlayer("player-1", { rowVersion: 1, name: "" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("there is no way to set status or mergedIntoPlayerId through update -- the payload type has no such fields", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store);
    // @ts-expect-error -- status/mergedIntoPlayerId are intentionally not part of UpdatePlayerPayload
    const payload: UpdatePlayerPayload = { rowVersion: 1, status: "MERGED", mergedIntoPlayerId: "other" };
    const result = updatePlayer("player-1", payload, store, "user-1", "now", "req-1");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.status).toBe("ACTIVE");
    expect(result.row.mergedIntoPlayerId).toBeNull();
  });
});

describe("getPlayer (TASK-0096)", () => {
  it("returns the row when it exists", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store);
    expect(getPlayer("player-1", store, "req-1").outcome).toBe("found");
  });

  it("404s when the id does not exist", () => {
    const store = new InMemoryPlayerStore();
    const result = getPlayer("no-such-player", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listPlayers (TASK-0096)", () => {
  it("returns items ordered by id ascending", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, { id: "player-b", name: "Beta" });
    seedPlayer(store, { id: "player-a", name: "Alpha" });
    const result = listPlayers({}, store);
    expect(result.items.map((r) => r.id)).toEqual(["player-a", "player-b"]);
  });

  it("filters by organizationId", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, { id: "player-a", organizationId: "org-1" });
    seedPlayer(store, { id: "player-b", organizationId: "org-2" });
    const result = listPlayers({ organizationId: "org-1" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["player-a"]);
  });

  it("filters by nameSearch case-insensitively", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, { id: "player-a", name: "Alex Rivera" });
    seedPlayer(store, { id: "player-b", name: "Harbour Smith" });
    const result = listPlayers({ nameSearch: "rivera" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["player-a"]);
  });

  it("respects limit and reports hasMore / nextCursor", () => {
    const store = new InMemoryPlayerStore();
    seedPlayer(store, { id: "player-a" });
    seedPlayer(store, { id: "player-b" });
    seedPlayer(store, { id: "player-c" });
    const result = listPlayers({ limit: 2 }, store);
    expect(result.items.map((r) => r.id)).toEqual(["player-a", "player-b"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("player-b");
  });
});
