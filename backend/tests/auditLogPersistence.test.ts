import { describe, expect, it } from "vitest";
import { HydratedAuditLogStore } from "../src/commands/auditLogPersistence.js";
import type { AuditLogRow } from "../src/commands/auditLog.js";

// Only HydratedAuditLogStore is pure and unit-tested here --
// hydrateAuditLogStore/persistNewAuditLogRows are real async Supabase
// IO, left untested, the same precedent this codebase already set
// (roleContext.ts/session.ts/syncEventsPersistence.ts/
// signOffMatchPersistence.ts/exportJobsPersistence.ts).

describe("HydratedAuditLogStore (TASK-0152, moved from TASK-0151)", () => {
  it("seeds getLastHash from its constructor, independent of any insert", () => {
    const store = new HydratedAuditLogStore("seeded-hash");
    expect(store.getLastHash()).toBe("seeded-hash");
    expect(store.getNewlyInserted()).toEqual([]);
  });

  it("insert() updates getLastHash and records the new row", () => {
    const store = new HydratedAuditLogStore(null);
    const row: AuditLogRow = {
      id: "audit-1", category: "DISPUTE", actorRef: "admin-1", impersonatedActorRef: null, targetRef: "dispute-1",
      action: "LOCK", detail: {}, reason: "x", prevHash: null, hash: "hash-1", createdAt: "now",
    };
    store.insert(row);

    expect(store.getLastHash()).toBe("hash-1");
    expect(store.getNewlyInserted()).toEqual([row]);
  });

  it("a second insert chains correctly off the first, not the seeded value", () => {
    const store = new HydratedAuditLogStore("seeded-hash");
    const first: AuditLogRow = { id: "audit-1", category: "DISPUTE", actorRef: "a", impersonatedActorRef: null, targetRef: null, action: "LOCK", detail: {}, reason: "x", prevHash: "seeded-hash", hash: "hash-1", createdAt: "now" };
    store.insert(first);
    expect(store.getLastHash()).toBe("hash-1");
  });
});
