import { describe, expect, it } from "vitest";
import { computeAuditLogHash, InMemoryAuditLogStore, writeAuditLogEntry } from "../src/commands/auditLog.js";

describe("writeAuditLogEntry (TASK-0146)", () => {
  it("writes a row with prevHash null for the first entry in the chain", () => {
    const store = new InMemoryAuditLogStore();
    const row = writeAuditLogEntry({ id: "audit-1", category: "EXPORT", actorRef: "user-1", action: "REQUEST", detail: {} }, store, "2026-10-05T00:00:00Z");

    expect(row.prevHash).toBeNull();
    expect(row.hash).toBeTypeOf("string");
    expect(row.hash.length).toBeGreaterThan(0);
  });

  it("chains a second entry's prevHash to the first entry's hash", () => {
    const store = new InMemoryAuditLogStore();
    const first = writeAuditLogEntry({ id: "audit-1", category: "EXPORT", actorRef: "user-1", action: "REQUEST", detail: {} }, store, "now");
    const second = writeAuditLogEntry({ id: "audit-2", category: "EXPORT", actorRef: "user-1", action: "COMPLETE", detail: {} }, store, "later");

    expect(second.prevHash).toBe(first.hash);
  });

  it("defaults impersonatedActorRef/targetRef/reason to null when omitted", () => {
    const store = new InMemoryAuditLogStore();
    const row = writeAuditLogEntry({ id: "audit-1", category: "AUTH", actorRef: "user-1", action: "LOGIN", detail: {} }, store, "now");

    expect(row.impersonatedActorRef).toBeNull();
    expect(row.targetRef).toBeNull();
    expect(row.reason).toBeNull();
  });

  it("throws when a reason-required category (ADMIN/DISPUTE/PLAYER_MERGE/OVERRIDE) is missing a reason", () => {
    const store = new InMemoryAuditLogStore();
    expect(() => writeAuditLogEntry({ id: "audit-1", category: "ADMIN", actorRef: "user-1", action: "SUSPEND", detail: {} }, store, "now")).toThrow();
  });

  it("does not throw for a non-reason-required category with no reason", () => {
    const store = new InMemoryAuditLogStore();
    expect(() => writeAuditLogEntry({ id: "audit-1", category: "AUTH", actorRef: "user-1", action: "LOGIN", detail: {} }, store, "now")).not.toThrow();
  });

  it("two entries with identical fields except createdAt produce different hashes", () => {
    const hashA = computeAuditLogHash(null, "AUTH", "user-1", null, null, "LOGIN", {}, null, "2026-10-05T00:00:00Z");
    const hashB = computeAuditLogHash(null, "AUTH", "user-1", null, null, "LOGIN", {}, null, "2026-10-05T00:00:01Z");
    expect(hashA).not.toBe(hashB);
  });

  it("computeAuditLogHash is deterministic for identical inputs", () => {
    const hashA = computeAuditLogHash("prev-1", "DISPUTE", "user-1", null, "dispute-1", "LOCK", { matchId: "match-1" }, "a reason", "2026-10-05T00:00:00Z");
    const hashB = computeAuditLogHash("prev-1", "DISPUTE", "user-1", null, "dispute-1", "LOCK", { matchId: "match-1" }, "a reason", "2026-10-05T00:00:00Z");
    expect(hashA).toBe(hashB);
  });
});
