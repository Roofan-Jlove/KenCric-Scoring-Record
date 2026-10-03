import { describe, expect, it } from "vitest";
import { InMemoryOrganizationStore, type OrganizationRow } from "../src/commands/organizations.js";
import { deleteOrganization, reactivateOrganization, suspendOrganization } from "../src/commands/organizationLifecycle.js";

function seedOrg(store: InMemoryOrganizationStore, id: string, status: OrganizationRow["status"] = "ACTIVE"): OrganizationRow {
  const row: OrganizationRow = {
    id,
    name: id,
    branding: null,
    status,
    rowVersion: 1,
    createdAt: "2026-10-01T00:00:00Z",
    createdBy: "admin-1",
    updatedAt: "2026-10-01T00:00:00Z",
    updatedBy: "admin-1",
  };
  store.insert(row);
  return row;
}

describe("suspendOrganization (TASK-0133)", () => {
  it("suspends an ACTIVE organization", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1");

    const result = suspendOrganization("org-1", "policy violation", "admin-1", store, "2026-10-04T00:00:00Z", "req-1");

    expect(result.outcome).toBe("suspended");
    if (result.outcome !== "suspended") throw new Error("unreachable");
    expect(result.row.status).toBe("SUSPENDED");
    expect(result.row.rowVersion).toBe(2);
  });

  it("missing reason is a schema failure (400)", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1");
    const result = suspendOrganization("org-1", undefined, "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("404s on an unknown organization id", () => {
    const store = new InMemoryOrganizationStore();
    const result = suspendOrganization("no-such-org", "reason", "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("rejects suspending an already-SUSPENDED organization (409)", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1", "SUSPENDED");
    const result = suspendOrganization("org-1", "reason", "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("rejects suspending an already-DELETED organization (409)", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1", "DELETED");
    const result = suspendOrganization("org-1", "reason", "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });
});

describe("reactivateOrganization (TASK-0133)", () => {
  it("reactivates a SUSPENDED organization", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1", "SUSPENDED");

    const result = reactivateOrganization("org-1", "admin-1", store, "2026-10-04T00:00:00Z", "req-1");

    expect(result.outcome).toBe("reactivated");
    if (result.outcome !== "reactivated") throw new Error("unreachable");
    expect(result.row.status).toBe("ACTIVE");
  });

  it("404s on an unknown organization id", () => {
    const store = new InMemoryOrganizationStore();
    const result = reactivateOrganization("no-such-org", "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("rejects reactivating an already-ACTIVE organization (409)", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1", "ACTIVE");
    const result = reactivateOrganization("org-1", "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("rejects reactivating a DELETED organization -- deletion is terminal (409)", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1", "DELETED");
    const result = reactivateOrganization("org-1", "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });
});

describe("deleteOrganization (TASK-0133)", () => {
  it("deletes an ACTIVE organization", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1");

    const result = deleteOrganization("org-1", "org closure", "admin-1", store, "2026-10-04T00:00:00Z", "req-1");

    expect(result.outcome).toBe("deleted");
    if (result.outcome !== "deleted") throw new Error("unreachable");
    expect(result.row.status).toBe("DELETED");
  });

  it("deletes a SUSPENDED organization too", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1", "SUSPENDED");

    const result = deleteOrganization("org-1", "org closure", "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("deleted");
  });

  it("missing reason is a schema failure (400)", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1");
    const result = deleteOrganization("org-1", undefined, "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("404s on an unknown organization id", () => {
    const store = new InMemoryOrganizationStore();
    const result = deleteOrganization("no-such-org", "reason", "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("rejects deleting an already-DELETED organization again (409)", () => {
    const store = new InMemoryOrganizationStore();
    seedOrg(store, "org-1", "DELETED");
    const result = deleteOrganization("org-1", "reason", "admin-1", store, "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });
});
