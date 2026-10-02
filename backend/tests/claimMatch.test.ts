import { describe, expect, it } from "vitest";
import { claimMatch, InMemoryIdempotencyStore } from "../src/commands/claimMatch.js";
import { createMatch, InMemoryMatchStore } from "../src/commands/matches.js";

function seedGuestMatch(store: InMemoryMatchStore) {
  const result = createMatch(
    {
      id: "match-1",
      organizationId: null,
      originDeviceId: "device-1",
      homeTeamId: "team-A",
      awayTeamId: "team-B",
      format: "T20",
      matchTimezone: "Asia/Karachi",
    },
    store,
    "guest-user-1",
    "2026-10-03T00:00:00Z",
    "req-seed",
  );
  if (result.outcome !== "created") throw new Error("seed failed");
  return result.row;
}

describe("claimMatch (TASK-0102)", () => {
  it("claims a guest match, binding an organizationId, without touching provenance", () => {
    const matchStore = new InMemoryMatchStore();
    const idempotencyStore = new InMemoryIdempotencyStore();
    seedGuestMatch(matchStore);

    const result = claimMatch("match-1", { organizationId: "org-1" }, matchStore, idempotencyStore, "user-2", "later", "key-1", "req-1");

    expect(result.outcome).toBe("claimed");
    if (result.outcome !== "claimed") throw new Error("unreachable");
    expect(result.row.claimStatus).toBe("CLAIMED");
    expect(result.row.organizationId).toBe("org-1");
    expect(result.row.rowVersion).toBe(2);
    expect(result.row.updatedBy).toBe("user-2");
    // Provenance is untouched.
    expect(result.row.originDeviceId).toBe("device-1");
    expect(result.row.createdBy).toBe("guest-user-1");
    expect(result.row.createdAt).toBe("2026-10-03T00:00:00Z");
    expect(result.row.id).toBe("match-1");
  });

  it("a null organizationId claims the match personally, not org-owned", () => {
    const matchStore = new InMemoryMatchStore();
    seedGuestMatch(matchStore);

    const result = claimMatch("match-1", { organizationId: null }, matchStore, new InMemoryIdempotencyStore(), "user-2", "later", "key-1", "req-1");
    expect(result.outcome).toBe("claimed");
    if (result.outcome !== "claimed") throw new Error("unreachable");
    expect(result.row.claimStatus).toBe("CLAIMED");
    expect(result.row.organizationId).toBeNull();
  });

  it("404s on a missing match", () => {
    const matchStore = new InMemoryMatchStore();
    const result = claimMatch("no-such-match", { organizationId: "org-1" }, matchStore, new InMemoryIdempotencyStore(), "user-1", "now", "key-1", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("replaying the same idempotency key returns the identical prior result, without reprocessing", () => {
    const matchStore = new InMemoryMatchStore();
    const idempotencyStore = new InMemoryIdempotencyStore();
    seedGuestMatch(matchStore);

    const first = claimMatch("match-1", { organizationId: "org-1" }, matchStore, idempotencyStore, "user-2", "2026-10-03T01:00:00Z", "key-1", "req-1");
    const second = claimMatch("match-1", { organizationId: "org-99" }, matchStore, idempotencyStore, "user-3", "much-later", "key-1", "req-2");

    expect(second).toEqual(first);
    if (second.outcome !== "claimed") throw new Error("unreachable");
    expect(second.row.organizationId).toBe("org-1");
    expect(second.row.updatedBy).toBe("user-2");
  });

  it("a key that previously failed (404) is reprocessed fresh on retry, not cached", () => {
    const matchStore = new InMemoryMatchStore();
    const idempotencyStore = new InMemoryIdempotencyStore();

    const first = claimMatch("match-1", { organizationId: "org-1" }, matchStore, idempotencyStore, "user-1", "now", "key-1", "req-1");
    expect(first.outcome).toBe("rejected");

    seedGuestMatch(matchStore);
    const second = claimMatch("match-1", { organizationId: "org-1" }, matchStore, idempotencyStore, "user-1", "later", "key-1", "req-2");
    expect(second.outcome).toBe("claimed");
  });

  it("a genuinely new claim attempt against an already-claimed match is rejected, never a silent re-grant", () => {
    const matchStore = new InMemoryMatchStore();
    seedGuestMatch(matchStore);

    claimMatch("match-1", { organizationId: "org-1" }, matchStore, new InMemoryIdempotencyStore(), "user-2", "now", "key-1", "req-1");

    const result = claimMatch("match-1", { organizationId: "org-2" }, matchStore, new InMemoryIdempotencyStore(), "user-3", "later", "key-2", "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
    // The original claim is untouched by the rejected second attempt.
    expect(matchStore.get("match-1")?.organizationId).toBe("org-1");
  });
});
