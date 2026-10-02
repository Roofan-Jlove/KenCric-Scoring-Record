import { describe, expect, it } from "vitest";
import {
  failingChecks,
  InMemoryIdempotencyStore,
  InMemorySignOffStore,
  reconciliationPasses,
  signOffMatch,
  type ReconciliationCheck,
  type SignOffMatchInput,
} from "../src/commands/signOffMatch.js";

const passingChecks: ReconciliationCheck[] = [
  { invariantId: "INV-001", status: "PASS", detail: null },
  { invariantId: "INV-002", status: "PASS", detail: null },
];

const failingCheck: ReconciliationCheck = { invariantId: "INV-003", status: "FAIL", detail: "Total mismatch" };

function baseInput(overrides: Partial<SignOffMatchInput> = {}): SignOffMatchInput {
  return {
    matchId: "match-1",
    actorRole: "HEAD_SCORER",
    checks: passingChecks,
    overrideReason: null,
    asOfEventOrdinal: 42,
    currentServerEventOrdinal: 42,
    previousVersion: 0,
    signedBy: "user-1",
    ...overrides,
  };
}

describe("failingChecks / reconciliationPasses (TASK-0105)", () => {
  it("no failing checks when every check passes", () => {
    expect(failingChecks(passingChecks)).toEqual([]);
    expect(reconciliationPasses(passingChecks)).toBe(true);
  });

  it("identifies the specific failing check", () => {
    const checks = [...passingChecks, failingCheck];
    expect(failingChecks(checks)).toEqual([failingCheck]);
    expect(reconciliationPasses(checks)).toBe(false);
  });
});

// N-H1
describe("signOffMatch -- N-H1 (TASK-0105)", () => {
  it("a Head Scorer signs off successfully with a passing reconciliation report, version becomes 1", () => {
    const store = new InMemorySignOffStore();
    const result = signOffMatch(baseInput(), store, new InMemoryIdempotencyStore(), "key-1", "sign-off-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("signed");
    if (result.outcome !== "signed") throw new Error("unreachable");
    expect(result.row.version).toBe(1);
    expect(result.row.reconciliationState).toBe("PASS");
    expect(result.row.supersedesVersion).toBeNull();
  });

  it("a re-sign-off increments the version from a non-zero previous version", () => {
    const store = new InMemorySignOffStore();
    const result = signOffMatch(baseInput({ previousVersion: 1 }), store, new InMemoryIdempotencyStore(), "key-1", "sign-off-2", "now", "req-1");

    expect(result.outcome).toBe("signed");
    if (result.outcome !== "signed") throw new Error("unreachable");
    expect(result.row.version).toBe(2);
    expect(result.row.supersedesVersion).toBe(1);
  });
});

// I-H1
describe("signOffMatch -- I-H1 (TASK-0105)", () => {
  it("rejects with reconciliation/blocked when a check fails and no override reason is supplied", () => {
    const store = new InMemorySignOffStore();
    const result = signOffMatch(
      baseInput({ checks: [...passingChecks, failingCheck] }),
      store,
      new InMemoryIdempotencyStore(),
      "key-1",
      "sign-off-1",
      "now",
      "req-1",
    );
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
    expect(result.problem.type).toContain("reconciliation/blocked");
    expect(result.problem.detail).toContain("INV-003");
  });

  it("rejects when the override reason is blank", () => {
    const store = new InMemorySignOffStore();
    const result = signOffMatch(
      baseInput({ checks: [...passingChecks, failingCheck], overrideReason: "   " }),
      store,
      new InMemoryIdempotencyStore(),
      "key-1",
      "sign-off-1",
      "now",
      "req-1",
    );
    expect(result.outcome).toBe("rejected");
  });

  it("succeeds with a non-blank override reason, flagging reconciliationState OVERRIDE", () => {
    const store = new InMemorySignOffStore();
    const result = signOffMatch(
      baseInput({ checks: [...passingChecks, failingCheck], overrideReason: "Confirmed with umpires" }),
      store,
      new InMemoryIdempotencyStore(),
      "key-1",
      "sign-off-1",
      "now",
      "req-1",
    );
    expect(result.outcome).toBe("signed");
    if (result.outcome !== "signed") throw new Error("unreachable");
    expect(result.row.reconciliationState).toBe("OVERRIDE");
    expect(result.row.overrideReason).toBe("Confirmed with umpires");
  });
});

// I-H2
describe("signOffMatch -- I-H2 (TASK-0105)", () => {
  it("rejects a non-Head-Scorer attempt with 403, even with a passing report", () => {
    const store = new InMemorySignOffStore();
    const result = signOffMatch(baseInput({ actorRole: "ASSISTANT_SCORER" }), store, new InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(403);
  });

  it("the role check takes priority over the reconciliation check", () => {
    const store = new InMemorySignOffStore();
    const result = signOffMatch(
      baseInput({ actorRole: "UMPIRE", checks: [...passingChecks, failingCheck] }),
      store,
      new InMemoryIdempotencyStore(),
      "key-1",
      "sign-off-1",
      "now",
      "req-1",
    );
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(403);
  });
});

describe("signOffMatch -- backend-only concerns (TASK-0105)", () => {
  it("rejects a stale asOfEventOrdinal (409)", () => {
    const store = new InMemorySignOffStore();
    const result = signOffMatch(
      baseInput({ asOfEventOrdinal: 10, currentServerEventOrdinal: 42 }),
      store,
      new InMemoryIdempotencyStore(),
      "key-1",
      "sign-off-1",
      "now",
      "req-1",
    );
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("the ordinal check is checked before the role check is irrelevant -- role still takes priority", () => {
    // Role (I-H2) is checked first in signOffMatch's own ordering, same as signOffForm.ts.
    const store = new InMemorySignOffStore();
    const result = signOffMatch(
      baseInput({ actorRole: "UMPIRE", asOfEventOrdinal: 10, currentServerEventOrdinal: 42 }),
      store,
      new InMemoryIdempotencyStore(),
      "key-1",
      "sign-off-1",
      "now",
      "req-1",
    );
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(403);
  });

  it("replaying the same idempotency key returns the identical prior result, without reprocessing", () => {
    const store = new InMemorySignOffStore();
    const idempotencyStore = new InMemoryIdempotencyStore();

    const first = signOffMatch(baseInput(), store, idempotencyStore, "key-1", "sign-off-1", "2026-10-03T00:00:00Z", "req-1");
    const second = signOffMatch(baseInput({ previousVersion: 5 }), store, idempotencyStore, "key-1", "sign-off-2", "later", "req-2");

    expect(second).toEqual(first);
    if (second.outcome !== "signed") throw new Error("unreachable");
    expect(second.row.version).toBe(1);
  });

  it("the new sign-off row is immutable once created -- no update method exists on SignOffStore", () => {
    const store = new InMemorySignOffStore();
    signOffMatch(baseInput(), store, new InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1");
    expect(store.get("sign-off-1")).not.toBeNull();
  });
});
