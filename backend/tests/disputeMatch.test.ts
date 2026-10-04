import { describe, expect, it } from "vitest";
import { InMemoryMatchStore, type MatchRow, type MatchState } from "../src/commands/matches.js";
import { adjudicateDispute, getDispute, InMemoryDisputeStore, listDisputes, lockMatchForDispute } from "../src/commands/disputeMatch.js";
import { InMemoryAuditLogStore } from "../src/commands/auditLog.js";

function seedMatch(store: InMemoryMatchStore, id: string, state: MatchState): MatchRow {
  const row: MatchRow = {
    id,
    organizationId: "org-1",
    originDeviceId: "device-1",
    claimStatus: "CLAIMED",
    homeTeamId: "team-A",
    awayTeamId: "team-B",
    homeXi: null,
    awayXi: null,
    format: "T20",
    oversAllotted: 20,
    conditionsProfile: null,
    conditionsProfileVersion: null,
    dlsTableVersion: null,
    rainMethod: "NONE",
    tossWinnerTeamId: null,
    tossDecision: null,
    venue: null,
    scheduledStart: null,
    matchTimezone: "Asia/Karachi",
    minOversForResult: null,
    state,
    result: null,
    rowVersion: 1,
    createdAt: "2026-10-01T00:00:00Z",
    createdBy: "user-1",
    updatedAt: "2026-10-01T00:00:00Z",
    updatedBy: "user-1",
  };
  store.insert(row);
  return row;
}

describe("lockMatchForDispute (TASK-0123)", () => {
  it("locks an in-progress match for dispute", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");

    const result = lockMatchForDispute("match-1", { reason: "scoring disagreement" }, matchStore, disputeStore, "dispute-1", "admin-1", "2026-10-04T00:00:00Z", "req-1");

    expect(result.outcome).toBe("locked");
    if (result.outcome !== "locked") throw new Error("unreachable");
    expect(result.row.status).toBe("OPEN");
    expect(result.row.lockedFromState).toBe("IN_PROGRESS");
  });

  it("transitions matches.state to DISPUTED", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");

    lockMatchForDispute("match-1", { reason: "scoring disagreement" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");

    expect(matchStore.get("match-1")?.state).toBe("DISPUTED");
  });

  it("missing reason is a schema failure (400)", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");
    const result = lockMatchForDispute("match-1", {}, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("404s on an unknown match id", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    const result = lockMatchForDispute("no-such-match", { reason: "x" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("rejects locking an already-DISPUTED match again (409)", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");
    lockMatchForDispute("match-1", { reason: "first" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");

    const result = lockMatchForDispute("match-1", { reason: "second" }, matchStore, disputeStore, "dispute-2", "admin-1", "later", "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("rejects a second open dispute on the same match (422)", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");
    // Seed an OPEN dispute directly without transitioning the match state,
    // to isolate this check from the already-DISPUTED 409 above.
    disputeStore.insert({
      id: "dispute-existing",
      matchId: "match-1",
      status: "OPEN",
      reason: "earlier",
      lockedFromState: "IN_PROGRESS",
      lockedBy: "admin-0",
      lockedAt: "earlier",
      ruling: null,
      resultingCorrections: null,
      adjudicatedBy: null,
      adjudicatedAt: null,
      rowVersion: 1,
    });

    const result = lockMatchForDispute("match-1", { reason: "second" }, matchStore, disputeStore, "dispute-2", "admin-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });
});

describe("adjudicateDispute (TASK-0123)", () => {
  it("adjudicates an open dispute and restores the match's pre-lock state", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "INNINGS_BREAK");
    lockMatchForDispute("match-1", { reason: "scoring disagreement" }, matchStore, disputeStore, "dispute-1", "admin-1", "2026-10-04T00:00:00Z", "req-1");

    const result = adjudicateDispute("match-1", { ruling: "Upheld as scored" }, matchStore, disputeStore, "admin-2", "2026-10-05T00:00:00Z", "req-2");

    expect(result.outcome).toBe("adjudicated");
    if (result.outcome !== "adjudicated") throw new Error("unreachable");
    expect(result.row.status).toBe("ADJUDICATED");
    expect(result.row.ruling).toBe("Upheld as scored");
    expect(matchStore.get("match-1")?.state).toBe("INNINGS_BREAK");
  });

  it("records resultingCorrections when provided", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");
    lockMatchForDispute("match-1", { reason: "disagreement" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");

    const result = adjudicateDispute("match-1", { ruling: "Amended", resultingCorrections: ["event-1", "event-2"] }, matchStore, disputeStore, "admin-2", "later", "req-2");
    expect(result.outcome).toBe("adjudicated");
    if (result.outcome !== "adjudicated") throw new Error("unreachable");
    expect(result.row.resultingCorrections).toEqual(["event-1", "event-2"]);
  });

  it("missing ruling is a schema failure (400)", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");
    lockMatchForDispute("match-1", { reason: "x" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");

    const result = adjudicateDispute("match-1", {}, matchStore, disputeStore, "admin-2", "later", "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("404s when no open dispute exists for the match", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");

    const result = adjudicateDispute("match-1", { ruling: "N/A" }, matchStore, disputeStore, "admin-2", "later", "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("404s when the dispute is already ADJUDICATED (no longer open)", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");
    lockMatchForDispute("match-1", { reason: "x" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");
    adjudicateDispute("match-1", { ruling: "Upheld" }, matchStore, disputeStore, "admin-2", "later", "req-2");

    const result = adjudicateDispute("match-1", { ruling: "second attempt" }, matchStore, disputeStore, "admin-3", "even-later", "req-3");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("getDispute (TASK-0124)", () => {
  it("returns the dispute when it exists", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");
    lockMatchForDispute("match-1", { reason: "x" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");

    const result = getDispute("dispute-1", disputeStore, "req-1");
    expect(result.outcome).toBe("found");
    if (result.outcome !== "found") throw new Error("unreachable");
    expect(result.row.id).toBe("dispute-1");
  });

  it("404s on an unknown dispute id", () => {
    const disputeStore = new InMemoryDisputeStore();
    const result = getDispute("no-such-dispute", disputeStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });
});

describe("listDisputes (TASK-0124)", () => {
  function seedTwoDisputes(matchStore: InMemoryMatchStore, disputeStore: InMemoryDisputeStore) {
    seedMatch(matchStore, "match-1", "IN_PROGRESS");
    seedMatch(matchStore, "match-2", "IN_PROGRESS");
    lockMatchForDispute("match-1", { reason: "a" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");
    lockMatchForDispute("match-2", { reason: "b" }, matchStore, disputeStore, "dispute-2", "admin-1", "now", "req-2");
  }

  it("lists every dispute with no filter", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedTwoDisputes(matchStore, disputeStore);

    const result = listDisputes({}, disputeStore);
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("filters by matchId", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedTwoDisputes(matchStore, disputeStore);

    const result = listDisputes({ matchId: "match-1" }, disputeStore);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].matchId).toBe("match-1");
  });

  it("filters by status", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedTwoDisputes(matchStore, disputeStore);
    adjudicateDispute("match-1", { ruling: "resolved" }, matchStore, disputeStore, "admin-2", "later", "req-3");

    const open = listDisputes({ status: "OPEN" }, disputeStore);
    expect(open.items).toHaveLength(1);
    expect(open.items[0].matchId).toBe("match-2");

    const adjudicated = listDisputes({ status: "ADJUDICATED" }, disputeStore);
    expect(adjudicated.items).toHaveLength(1);
    expect(adjudicated.items[0].matchId).toBe("match-1");
  });

  it("respects limit and reports hasMore/nextCursor", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedTwoDisputes(matchStore, disputeStore);

    const result = listDisputes({ limit: 1 }, disputeStore);
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe(result.items[0].id);
  });

  it("paginates past a cursor via after", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedTwoDisputes(matchStore, disputeStore);

    const first = listDisputes({ limit: 1 }, disputeStore);
    const second = listDisputes({ limit: 1, after: first.nextCursor }, disputeStore);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect(second.hasMore).toBe(false);
  });
});

describe("audit_log wiring (TASK-0146)", () => {
  it("lockMatchForDispute writes a DISPUTE/LOCK row when auditLog is passed", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    const auditLogStore = new InMemoryAuditLogStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");

    lockMatchForDispute("match-1", { reason: "scoring disagreement" }, matchStore, disputeStore, "dispute-1", "admin-1", "2026-10-05T00:00:00Z", "req-1", {
      store: auditLogStore,
      newId: "audit-1",
    });

    const rows = auditLogStore.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("DISPUTE");
    expect(rows[0].action).toBe("LOCK");
    expect(rows[0].targetRef).toBe("dispute-1");
    expect(rows[0].reason).toBe("scoring disagreement");
  });

  it("adjudicateDispute writes a DISPUTE/ADJUDICATE row when auditLog is passed", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    const auditLogStore = new InMemoryAuditLogStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");
    lockMatchForDispute("match-1", { reason: "x" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");

    adjudicateDispute("match-1", { ruling: "Upheld as scored" }, matchStore, disputeStore, "admin-2", "2026-10-05T00:00:00Z", "req-2", { store: auditLogStore, newId: "audit-1" });

    const rows = auditLogStore.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("DISPUTE");
    expect(rows[0].action).toBe("ADJUDICATE");
    expect(rows[0].targetRef).toBe("dispute-1");
    expect(rows[0].reason).toBe("Upheld as scored");
  });

  it("with no auditLog passed, no row is written (today's behavior, unchanged)", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");

    const result = lockMatchForDispute("match-1", { reason: "x" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1");
    expect(result.outcome).toBe("locked");
  });

  it("a rejected lockMatchForDispute writes no audit row", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    const auditLogStore = new InMemoryAuditLogStore();

    const result = lockMatchForDispute("match-1", { reason: "x" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1", { store: auditLogStore, newId: "audit-1" });
    expect(result.outcome).toBe("rejected");
    expect(auditLogStore.list()).toHaveLength(0);
  });

  it("two audit entries chain: the second row's prevHash equals the first row's hash", () => {
    const matchStore = new InMemoryMatchStore();
    const disputeStore = new InMemoryDisputeStore();
    const auditLogStore = new InMemoryAuditLogStore();
    seedMatch(matchStore, "match-1", "IN_PROGRESS");

    lockMatchForDispute("match-1", { reason: "x" }, matchStore, disputeStore, "dispute-1", "admin-1", "now", "req-1", { store: auditLogStore, newId: "audit-1" });
    adjudicateDispute("match-1", { ruling: "Upheld" }, matchStore, disputeStore, "admin-2", "later", "req-2", { store: auditLogStore, newId: "audit-2" });

    const rows = auditLogStore.list();
    expect(rows[0].prevHash).toBeNull();
    expect(rows[1].prevHash).toBe(rows[0].hash);
  });
});
