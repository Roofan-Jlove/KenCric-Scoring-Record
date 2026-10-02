import { describe, expect, it } from "vitest";
import { deactivateMember, InMemoryIdempotencyStore } from "../src/commands/deactivateMember.js";
import { createMembership, InMemoryMembershipStore } from "../src/commands/memberships.js";

function seedMembership(store: InMemoryMembershipStore) {
  const result = createMembership(
    { id: "mem-1", userId: "user-1", organizationId: "org-1", roles: ["HEAD_SCORER"] },
    store,
    "admin-1",
    "2026-10-03T00:00:00Z",
    "req-seed",
  );
  if (result.outcome !== "created") throw new Error("seed failed");
  return result.row;
}

describe("deactivateMember (TASK-0101)", () => {
  it("sets status to DEACTIVATED and bumps row_version", () => {
    const membershipStore = new InMemoryMembershipStore();
    const idempotencyStore = new InMemoryIdempotencyStore();
    seedMembership(membershipStore);

    const result = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-2", "later", "req-1");

    expect(result.outcome).toBe("deactivated");
    if (result.outcome !== "deactivated") throw new Error("unreachable");
    expect(result.row.status).toBe("DEACTIVATED");
    expect(result.row.rowVersion).toBe(2);
    expect(result.row.updatedBy).toBe("admin-2");
    // Roles are untouched by deactivation.
    expect(result.row.roles).toEqual(["HEAD_SCORER"]);
  });

  it("404s on a missing membership", () => {
    const membershipStore = new InMemoryMembershipStore();
    const idempotencyStore = new InMemoryIdempotencyStore();

    const result = deactivateMember("no-such-mem", "key-1", membershipStore, idempotencyStore, "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("replaying the same idempotency key returns the identical prior result, without reprocessing", () => {
    const membershipStore = new InMemoryMembershipStore();
    const idempotencyStore = new InMemoryIdempotencyStore();
    seedMembership(membershipStore);

    const first = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-2", "2026-10-03T01:00:00Z", "req-1");
    const second = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-3", "much-later", "req-2");

    expect(second).toEqual(first);
    if (second.outcome !== "deactivated") throw new Error("unreachable");
    // The second call's own actorRef/nowIso never took effect -- the cached result is byte-identical.
    expect(second.row.updatedBy).toBe("admin-2");
    expect(second.row.rowVersion).toBe(2);
  });

  it("a key that previously failed (404) is reprocessed fresh on retry, not cached", () => {
    const membershipStore = new InMemoryMembershipStore();
    const idempotencyStore = new InMemoryIdempotencyStore();

    const first = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-1", "now", "req-1");
    expect(first.outcome).toBe("rejected");

    // Now the membership exists -- the same key should succeed, not replay the 404.
    seedMembership(membershipStore);
    const second = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-1", "later", "req-2");
    expect(second.outcome).toBe("deactivated");
  });

  it("deactivating an already-deactivated membership is a safe no-op, not an error", () => {
    const membershipStore = new InMemoryMembershipStore();
    seedMembership(membershipStore);

    deactivateMember("mem-1", "key-1", membershipStore, new InMemoryIdempotencyStore(), "admin-1", "now", "req-1");

    const result = deactivateMember("mem-1", "key-2", membershipStore, new InMemoryIdempotencyStore(), "admin-2", "later", "req-2");
    expect(result.outcome).toBe("deactivated");
    if (result.outcome !== "deactivated") throw new Error("unreachable");
    expect(result.row.status).toBe("DEACTIVATED");
    // No further mutation on the already-deactivated no-op path.
    expect(result.row.rowVersion).toBe(2);
  });

  it("different idempotency keys against the same membership each process independently when the first hasn't happened yet", () => {
    const membershipStore = new InMemoryMembershipStore();
    const idempotencyStore = new InMemoryIdempotencyStore();
    seedMembership(membershipStore);

    deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-1", "now", "req-1");
    const result = deactivateMember("mem-1", "key-2", membershipStore, idempotencyStore, "admin-2", "later", "req-2");

    // key-2 hits the already-deactivated no-op path, not a fresh mutation.
    expect(result.outcome).toBe("deactivated");
    if (result.outcome !== "deactivated") throw new Error("unreachable");
    expect(result.row.rowVersion).toBe(2);
  });
});
