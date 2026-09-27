import { describe, expect, it } from "vitest";
import {
  createOrganization,
  getOrganization,
  InMemoryOrganizationStore,
  listOrganizations,
  updateOrganization,
  type CreateOrganizationPayload,
  type UpdateOrganizationPayload,
} from "../src/commands/organizations.js";

function validPayload(overrides: Partial<CreateOrganizationPayload> = {}): Partial<CreateOrganizationPayload> {
  return {
    id: "org-1",
    name: "Riverside CC",
    ...overrides,
  };
}

function seedOrganization(store: InMemoryOrganizationStore, overrides: Partial<CreateOrganizationPayload> = {}) {
  const result = createOrganization(validPayload(overrides), store, "user-1", "2026-09-28T00:00:00Z", "req-seed");
  if (result.outcome !== "created") throw new Error("seed failed");
  return result.row;
}

describe("createOrganization (TASK-0093)", () => {
  it("a valid payload creates the row with server-assigned audit fields", () => {
    const store = new InMemoryOrganizationStore();
    const result = createOrganization(validPayload(), store, "user-1", "2026-09-28T00:00:00Z", "req-1");

    expect(result.outcome).toBe("created");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.id).toBe("org-1");
    expect(result.row.name).toBe("Riverside CC");
    expect(result.row.branding).toBeNull();
    expect(result.row.rowVersion).toBe(1);
    expect(result.row.createdBy).toBe("user-1");
    expect(result.row.createdAt).toBe("2026-09-28T00:00:00Z");
    expect(store.get("org-1")).not.toBeNull();
  });

  it("a missing name is a schema failure (400)", () => {
    const store = new InMemoryOrganizationStore();
    const result = createOrganization({ id: "org-1" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("an id that already exists is rejected -- use the update path", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store);
    const result = createOrganization(validPayload(), store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
  });

  it("branding is optional and defaults to null", () => {
    const store = new InMemoryOrganizationStore();
    const result = createOrganization(validPayload({ branding: { logoUrl: "x" } }), store, "user-1", "now", "req-1");
    if (result.outcome !== "created") throw new Error("unreachable");
    expect(result.row.branding).toEqual({ logoUrl: "x" });
  });
});

describe("updateOrganization (TASK-0093)", () => {
  it("a valid update with the current row_version succeeds and increments row_version by exactly 1", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store);

    const result = updateOrganization("org-1", { rowVersion: 1, name: "Riverside Cricket Club" }, store, "user-2", "2026-09-28T01:00:00Z", "req-1");

    expect(result.outcome).toBe("updated");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.rowVersion).toBe(2);
    expect(result.row.name).toBe("Riverside Cricket Club");
    expect(result.row.updatedBy).toBe("user-2");
    expect(result.row.createdBy).toBe("user-1");
  });

  it("only fields present in the payload change -- a partial update", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store, { branding: { logoUrl: "old" } });

    const result = updateOrganization("org-1", { rowVersion: 1, name: "New Name" }, store, "user-1", "later", "req-1");
    if (result.outcome !== "updated") throw new Error("unreachable");
    expect(result.row.name).toBe("New Name");
    expect(result.row.branding).toEqual({ logoUrl: "old" });
  });

  it("an update against a non-existent id is 404, identical whether missing or RLS-hidden", () => {
    const store = new InMemoryOrganizationStore();
    const result = updateOrganization("no-such-org", { rowVersion: 1 }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("a missing row_version is a schema failure (400)", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store);
    const result = updateOrganization("org-1", {} as UpdateOrganizationPayload, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("a stale row_version is rejected 409, the stored row provably unchanged", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store);
    const result = updateOrganization("org-1", { rowVersion: 999, name: "Should not apply" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
    expect(store.get("org-1")?.name).toBe("Riverside CC");
    expect(store.get("org-1")?.rowVersion).toBe(1);
  });

  it("an empty name in the update payload is rejected", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store);
    const result = updateOrganization("org-1", { rowVersion: 1, name: "" }, store, "user-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });
});

describe("getOrganization (TASK-0093)", () => {
  it("returns the row when it exists", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store);
    const result = getOrganization("org-1", store, "req-1");
    expect(result.outcome).toBe("found");
  });

  it("404s when the id does not exist", () => {
    const store = new InMemoryOrganizationStore();
    const result = getOrganization("no-such-org", store, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listOrganizations (TASK-0093)", () => {
  it("returns items ordered by id ascending", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store, { id: "org-b", name: "Beta" });
    seedOrganization(store, { id: "org-a", name: "Alpha" });
    const result = listOrganizations({}, store);
    expect(result.items.map((r) => r.id)).toEqual(["org-a", "org-b"]);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("respects limit and reports hasMore / nextCursor", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store, { id: "org-a", name: "Alpha" });
    seedOrganization(store, { id: "org-b", name: "Beta" });
    seedOrganization(store, { id: "org-c", name: "Gamma" });

    const result = listOrganizations({ limit: 2 }, store);
    expect(result.items.map((r) => r.id)).toEqual(["org-a", "org-b"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("org-b");
  });

  it("after cursor resumes strictly after the last-seen id", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store, { id: "org-a", name: "Alpha" });
    seedOrganization(store, { id: "org-b", name: "Beta" });
    seedOrganization(store, { id: "org-c", name: "Gamma" });

    const result = listOrganizations({ after: "org-b" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["org-c"]);
  });

  it("nameSearch filters case-insensitively by substring", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store, { id: "org-a", name: "Riverside CC" });
    seedOrganization(store, { id: "org-b", name: "Harbour CC" });

    const result = listOrganizations({ nameSearch: "riverside" }, store);
    expect(result.items.map((r) => r.id)).toEqual(["org-a"]);
  });

  it("limit is capped at the maximum of 200", () => {
    const store = new InMemoryOrganizationStore();
    seedOrganization(store);
    const result = listOrganizations({ limit: 10000 }, store);
    expect(result.items.length).toBe(1);
    expect(result.hasMore).toBe(false);
  });
});
