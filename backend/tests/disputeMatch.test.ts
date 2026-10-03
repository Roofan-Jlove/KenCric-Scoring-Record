import { describe, expect, it } from "vitest";
import { InMemoryMatchStore, type MatchRow, type MatchState } from "../src/commands/matches.js";
import { adjudicateDispute, InMemoryDisputeStore, lockMatchForDispute } from "../src/commands/disputeMatch.js";

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
