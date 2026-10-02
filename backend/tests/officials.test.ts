import { describe, expect, it } from "vitest";
import {
  createOfficial,
  deleteOfficial,
  getOfficial,
  InMemoryOfficialStore,
  listOfficials,
  updateOfficial,
  type CreateOfficialPayload,
  type UpdateOfficialPayload,
} from "../src/commands/officials.js";

function validPayload(overrides: Partial<CreateOfficialPayload> = {}): Partial<CreateOfficialPayload> {
  return {
    id: "official-1",
    organizationId: "org-1",
    name: "Jordan Lee",
    ...overrides,
  };
}

function seedOfficial(store: InMemoryOfficialStore, overrides: Partial<CreateOfficialPayload> = {}) {
  const result = createOfficial(validPayload(overrides), store, "user-1", "2026-10-03T00:00:00Z", "req-seed");
  if (result.outcome !== "created") throw new Error("seed failed");
  return result.row;
}

describe("createOfficial (TASK-0098)", () => {
  it("a valid payload creates the row with server-assigned audit fields", () => {
    const store = new InMemoryOfficialStore();
    const result = createOfficial(validPayload(), store, "user-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.id).toBe("official-1");
    expect(result.row.userId).toBeNull();
    expect(result.row.rowVersion).toBe(1);
    expect(result.row.createdBy).toBe("user-1");
  });

  it("accepts an optional userId for an official who also holds a platform account", () => {
    const store = new InMemoryOfficialStore();
    const result = createOfficial(validPayload({ userId: "user-42" }), store, "user-1", "now", "req-1");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.userId).toBe("user-42");
  });

  it("a missing name is a schema failure (400)", () => {
    const store = new InMemoryOfficialStore();
    const result = createOfficial({ id: "official-1" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("an id that already exists is rejected -- use the update path", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store);
    const result = createOfficial(validPayload(), store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
  });
});

describe("updateOfficial (TASK-0098)", () => {
  it("a valid update with the current row_version succeeds and increments row_version by exactly 1", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store);
    const result = updateOfficial("official-1", { rowVersion: 1, name: "Jordan A. Lee" }, store, "user-2", "later", "req-1");
    expect(result.outcome).toBe("updated");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.name).toBe("Jordan A. Lee");
    expect(result.row.rowVersion).toBe(2);
  });

  it("only fields present in the payload change -- a partial update", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store, { userId: "user-42" });
    const result = updateOfficial("official-1", { rowVersion: 1, name: "New Name" }, store, "user-1", "later", "req-1");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.name).toBe("New Name");
    expect(result.row.userId).toBe("user-42");
  });

  it("an update against a non-existent id is 404", () => {
    const store = new InMemoryOfficialStore();
    const result = updateOfficial("no-such-official", { rowVersion: 1 }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("a missing row_version is a schema failure (400)", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store);
    const result = updateOfficial("official-1", {} as UpdateOfficialPayload, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("a stale row_version is rejected 409, the stored row provably unchanged", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store);
    const result = updateOfficial("official-1", { rowVersion: 999, name: "Should not apply" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
    expect(store.get("official-1")?.name).toBe("Jordan Lee");
  });
});

describe("getOfficial (TASK-0098)", () => {
  it("returns the row when it exists", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store);
    expect(getOfficial("official-1", store, "req-1").outcome).toBe("found");
  });

  it("404s when the id does not exist", () => {
    const store = new InMemoryOfficialStore();
    const result = getOfficial("no-such-official", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listOfficials (TASK-0098)", () => {
  it("returns items ordered by id ascending", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store, { id: "official-b" });
    seedOfficial(store, { id: "official-a" });
    const result = listOfficials({}, store);
    expect(result.items.map((r) => r.id)).toEqual(["official-a", "official-b"]);
  });

  it("filters by organizationId", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store, { id: "official-a", organizationId: "org-1" });
    seedOfficial(store, { id: "official-b", organizationId: "org-2" });
    const result = listOfficials({ organizationId: "org-1" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["official-a"]);
  });

  it("respects limit and reports hasMore / nextCursor", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store, { id: "official-a" });
    seedOfficial(store, { id: "official-b" });
    seedOfficial(store, { id: "official-c" });
    const result = listOfficials({ limit: 2 }, store);
    expect(result.items.map((r) => r.id)).toEqual(["official-a", "official-b"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("official-b");
  });
});

describe("deleteOfficial (TASK-0098)", () => {
  it("404s when the id does not exist", () => {
    const store = new InMemoryOfficialStore();
    const result = deleteOfficial("no-such-official", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("refuses (422) an official with a match assignment", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store);
    store.markHasMatchAssignment("official-1");
    const result = deleteOfficial("official-1", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
    expect(store.get("official-1")).not.toBeNull();
  });

  it("succeeds for a never-assigned official, with no authorship restriction", () => {
    const store = new InMemoryOfficialStore();
    seedOfficial(store);
    const result = deleteOfficial("official-1", store, "req-1");
    expect(result.outcome).toBe("deleted");
    expect(store.get("official-1")).toBeNull();
  });
});
