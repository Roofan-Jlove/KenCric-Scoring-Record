import { describe, expect, it } from "vitest";
import {
  createTeam,
  deleteTeam,
  getTeam,
  InMemoryTeamStore,
  listTeams,
  updateTeam,
  type CreateTeamPayload,
  type UpdateTeamPayload,
} from "../src/commands/teams.js";

function validPayload(overrides: Partial<CreateTeamPayload> = {}): Partial<CreateTeamPayload> {
  return {
    id: "team-1",
    organizationId: "org-1",
    name: "Riverside CC",
    ...overrides,
  };
}

function seedTeam(store: InMemoryTeamStore, overrides: Partial<CreateTeamPayload> = {}) {
  const result = createTeam(validPayload(overrides), store, "user-1", "2026-09-28T00:00:00Z", "req-seed");
  if (result.outcome !== "created") throw new Error("seed failed");
  return result.row;
}

describe("createTeam (TASK-0094)", () => {
  it("a valid payload creates the row with server-assigned audit fields", () => {
    const store = new InMemoryTeamStore();
    const result = createTeam(validPayload(), store, "user-1", "2026-09-28T00:00:00Z", "req-1");

    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.id).toBe("team-1");
    expect(result.row.organizationId).toBe("org-1");
    expect(result.row.canonicalRef).toBeNull();
    expect(result.row.rowVersion).toBe(1);
    expect(result.row.createdBy).toBe("user-1");
  });

  it("a null organizationId creates an ad-hoc/guest team", () => {
    const store = new InMemoryTeamStore();
    const result = createTeam(validPayload({ organizationId: null }), store, "user-1", "now", "req-1");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.organizationId).toBeNull();
  });

  it("a missing name is a schema failure (400)", () => {
    const store = new InMemoryTeamStore();
    const result = createTeam({ id: "team-1" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("an id that already exists is rejected -- use the update path", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store);
    const result = createTeam(validPayload(), store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
  });
});

describe("updateTeam (TASK-0094)", () => {
  it("a valid update with the current row_version succeeds and increments row_version by exactly 1", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store);
    const result = updateTeam("team-1", { rowVersion: 1, name: "Riverside Cricket Club" }, store, "user-2", "later", "req-1");
    expect(result.outcome).toBe("updated");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.rowVersion).toBe(2);
    expect(result.row.name).toBe("Riverside Cricket Club");
  });

  it("only fields present in the payload change -- a partial update", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store, { canonicalRef: "canon-1" });
    const result = updateTeam("team-1", { rowVersion: 1, name: "New Name" }, store, "user-1", "later", "req-1");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.name).toBe("New Name");
    expect(result.row.canonicalRef).toBe("canon-1");
  });

  it("an update against a non-existent id is 404", () => {
    const store = new InMemoryTeamStore();
    const result = updateTeam("no-such-team", { rowVersion: 1 }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("a missing row_version is a schema failure (400)", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store);
    const result = updateTeam("team-1", {} as UpdateTeamPayload, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("a stale row_version is rejected 409, the stored row provably unchanged", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store);
    const result = updateTeam("team-1", { rowVersion: 999, name: "Should not apply" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
    expect(store.get("team-1")?.name).toBe("Riverside CC");
  });
});

describe("getTeam (TASK-0094)", () => {
  it("returns the row when it exists", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store);
    expect(getTeam("team-1", store, "req-1").outcome).toBe("found");
  });

  it("404s when the id does not exist", () => {
    const store = new InMemoryTeamStore();
    const result = getTeam("no-such-team", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listTeams (TASK-0094)", () => {
  it("returns items ordered by id ascending", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store, { id: "team-b", name: "Beta" });
    seedTeam(store, { id: "team-a", name: "Alpha" });
    const result = listTeams({}, store);
    expect(result.items.map((r) => r.id)).toEqual(["team-a", "team-b"]);
  });

  it("filters by organizationId", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store, { id: "team-a", organizationId: "org-1" });
    seedTeam(store, { id: "team-b", organizationId: "org-2" });
    const result = listTeams({ organizationId: "org-1" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["team-a"]);
  });

  it("filters by nameSearch case-insensitively", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store, { id: "team-a", name: "Riverside CC" });
    seedTeam(store, { id: "team-b", name: "Harbour CC" });
    const result = listTeams({ nameSearch: "riverside" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["team-a"]);
  });

  it("respects limit and reports hasMore / nextCursor", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store, { id: "team-a" });
    seedTeam(store, { id: "team-b" });
    seedTeam(store, { id: "team-c" });
    const result = listTeams({ limit: 2 }, store);
    expect(result.items.map((r) => r.id)).toEqual(["team-a", "team-b"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("team-b");
  });
});

describe("deleteTeam (TASK-0094)", () => {
  it("404s when the id does not exist", () => {
    const store = new InMemoryTeamStore();
    const result = deleteTeam("no-such-team", store, "user-1", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("refuses (422) a team with match history, regardless of who asks", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store);
    store.markHasMatchHistory("team-1");
    const result = deleteTeam("team-1", store, "user-1", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
    expect(store.get("team-1")).not.toBeNull();
  });

  it("refuses (403) a caller who is not the team's own creator, even with no match history", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store);
    const result = deleteTeam("team-1", store, "someone-else", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(403);
    expect(store.get("team-1")).not.toBeNull();
  });

  it("succeeds for the team's own creator with no match history", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store);
    const result = deleteTeam("team-1", store, "user-1", "req-1");
    expect(result.outcome).toBe("deleted");
    expect(store.get("team-1")).toBeNull();
  });

  it("checks match-history before authorship -- history refuses even the creator", () => {
    const store = new InMemoryTeamStore();
    seedTeam(store);
    store.markHasMatchHistory("team-1");
    const result = deleteTeam("team-1", store, "user-1", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });
});
