import { describe, expect, it } from "vitest";
import {
  createMembership,
  getMembership,
  InMemoryMembershipStore,
  listMemberships,
  updateMembership,
  type CreateMembershipPayload,
  type UpdateMembershipPayload,
} from "../src/commands/memberships.js";

function validPayload(overrides: Partial<CreateMembershipPayload> = {}): Partial<CreateMembershipPayload> {
  return {
    id: "mem-1",
    userId: "user-1",
    organizationId: "org-1",
    ...overrides,
  };
}

function seedMembership(store: InMemoryMembershipStore, overrides: Partial<CreateMembershipPayload> = {}) {
  const result = createMembership(validPayload(overrides), store, "admin-1", "2026-10-03T00:00:00Z", "req-seed");
  if (result.outcome !== "created") throw new Error("seed failed");
  return result.row;
}

describe("createMembership (TASK-0095)", () => {
  it("a valid payload creates the row, always ACTIVE, with server-assigned audit fields", () => {
    const store = new InMemoryMembershipStore();
    const result = createMembership(validPayload(), store, "admin-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.status).toBe("ACTIVE");
    expect(result.row.roles).toEqual([]);
    expect(result.row.rowVersion).toBe(1);
    expect(result.row.createdBy).toBe("admin-1");
  });

  it("accepts a valid roles array", () => {
    const store = new InMemoryMembershipStore();
    const result = createMembership(validPayload({ roles: ["HEAD_SCORER", "TEAM_MANAGER"] }), store, "admin-1", "now", "req-1");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.roles).toEqual(["HEAD_SCORER", "TEAM_MANAGER"]);
  });

  it("rejects an invalid role (422)", () => {
    const store = new InMemoryMembershipStore();
    const result = createMembership(validPayload({ roles: ["NOT_A_REAL_ROLE"] }), store, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });

  it("a missing userId is a schema failure (400)", () => {
    const store = new InMemoryMembershipStore();
    const result = createMembership({ id: "mem-1", organizationId: "org-1" }, store, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("an id that already exists is rejected -- use the update path", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store);
    const result = createMembership(validPayload({ id: "mem-1" }), store, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
  });

  it("rejects a second membership for the same (userId, organizationId) pair under a different id", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store);
    const result = createMembership(validPayload({ id: "mem-2" }), store, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });

  it("the same user in a different organization is allowed", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store);
    const result = createMembership(validPayload({ id: "mem-2", organizationId: "org-2" }), store, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("created");
  });
});

describe("updateMembership (TASK-0095)", () => {
  it("a valid roles update succeeds and increments row_version by exactly 1", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store);
    const result = updateMembership("mem-1", { rowVersion: 1, roles: ["UMPIRE"] }, store, "admin-2", "later", "req-1");
    expect(result.outcome).toBe("updated");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.roles).toEqual(["UMPIRE"]);
    expect(result.row.rowVersion).toBe(2);
    expect(result.row.status).toBe("ACTIVE");
  });

  it("rejects an invalid role on update (422)", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store);
    const result = updateMembership("mem-1", { rowVersion: 1, roles: ["NOT_A_REAL_ROLE"] }, store, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });

  it("an update against a non-existent id is 404", () => {
    const store = new InMemoryMembershipStore();
    const result = updateMembership("no-such-mem", { rowVersion: 1 }, store, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("a missing row_version is a schema failure (400)", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store);
    const result = updateMembership("mem-1", {} as UpdateMembershipPayload, store, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("a stale row_version is rejected 409, the stored row provably unchanged", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store, { roles: ["VIEWER"] });
    const result = updateMembership("mem-1", { rowVersion: 999, roles: ["PLATFORM_ADMIN"] }, store, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
    expect(store.get("mem-1")?.roles).toEqual(["VIEWER"]);
  });

  it("there is no way to set status through this update -- the payload type has no such field", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store);
    // @ts-expect-error -- status is intentionally not part of UpdateMembershipPayload
    const payload: UpdateMembershipPayload = { rowVersion: 1, status: "DEACTIVATED" };
    const result = updateMembership("mem-1", payload, store, "admin-1", "now", "req-1");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.status).toBe("ACTIVE");
  });
});

describe("getMembership (TASK-0095)", () => {
  it("returns the row when it exists", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store);
    expect(getMembership("mem-1", store, "req-1").outcome).toBe("found");
  });

  it("404s when the id does not exist", () => {
    const store = new InMemoryMembershipStore();
    const result = getMembership("no-such-mem", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listMemberships (TASK-0095)", () => {
  it("returns items ordered by id ascending", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store, { id: "mem-b", userId: "user-b" });
    seedMembership(store, { id: "mem-a", userId: "user-a" });
    const result = listMemberships({}, store);
    expect(result.items.map((r) => r.id)).toEqual(["mem-a", "mem-b"]);
  });

  it("filters by organizationId", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store, { id: "mem-a", userId: "user-a", organizationId: "org-1" });
    seedMembership(store, { id: "mem-b", userId: "user-b", organizationId: "org-2" });
    const result = listMemberships({ organizationId: "org-1" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["mem-a"]);
  });

  it("filters by userId", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store, { id: "mem-a", userId: "user-a", organizationId: "org-1" });
    seedMembership(store, { id: "mem-b", userId: "user-b", organizationId: "org-1" });
    const result = listMemberships({ userId: "user-b" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["mem-b"]);
  });

  it("filters by status", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store, { id: "mem-a", userId: "user-a" });
    const result = listMemberships({ status: "ACTIVE" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["mem-a"]);
    expect(listMemberships({ status: "DEACTIVATED" }, store).items).toEqual([]);
  });

  it("respects limit and reports hasMore / nextCursor", () => {
    const store = new InMemoryMembershipStore();
    seedMembership(store, { id: "mem-a", userId: "user-a" });
    seedMembership(store, { id: "mem-b", userId: "user-b" });
    seedMembership(store, { id: "mem-c", userId: "user-c" });
    const result = listMemberships({ limit: 2 }, store);
    expect(result.items.map((r) => r.id)).toEqual(["mem-a", "mem-b"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("mem-b");
  });
});
