import { describe, expect, it } from "vitest";
import {
  HydratedMatchEventStore,
  mapFeatureFlagRowFromDb,
  mapIncomingPushEventToInsertRow,
  mapMatchEventRowFromDb,
  mapMatchOfficialRowFromDb,
  mapOfficialRowFromDb,
} from "../src/sync/syncEventsPersistence.js";
import type { IncomingPushEvent } from "../src/sync/ingestPushBatch.js";

// Only the pure mapping functions and HydratedMatchEventStore are
// tested here -- hydrateSyncEventsDeps/persistAcceptedEvents are real
// async Supabase I/O, left untested, the SAME precedent this codebase
// already set for roleContext.ts's own fetchRoleContext/session.ts's
// resolveUserId (neither has ever had a test; only the pure
// computeRoleContext does).

describe("row <-> type mapping (TASK-0148)", () => {
  it("mapOfficialRowFromDb maps snake_case DB columns to camelCase fields", () => {
    const row = mapOfficialRowFromDb({
      id: "official-1", organization_id: "org-1", user_id: "user-1", name: "Jane",
      row_version: 2, created_at: "2026-10-01T00:00:00Z", created_by: "admin-1",
      updated_at: "2026-10-02T00:00:00Z", updated_by: "admin-2",
    });
    expect(row).toEqual({
      id: "official-1", organizationId: "org-1", userId: "user-1", name: "Jane",
      rowVersion: 2, createdAt: "2026-10-01T00:00:00Z", createdBy: "admin-1",
      updatedAt: "2026-10-02T00:00:00Z", updatedBy: "admin-2",
    });
  });

  it("mapMatchOfficialRowFromDb maps the composite-key row", () => {
    const row = mapMatchOfficialRowFromDb({ match_id: "match-1", official_id: "official-1", role: "HEAD_SCORER", created_at: "now", created_by: "admin-1" });
    expect(row).toEqual({ matchId: "match-1", officialId: "official-1", role: "HEAD_SCORER", createdAt: "now", createdBy: "admin-1" });
  });

  it("mapFeatureFlagRowFromDb maps the flag row", () => {
    const row = mapFeatureFlagRowFromDb({ key: "delivery-domain-validation-bypass", enabled: true, updated_at: "now", updated_by: "admin-1" });
    expect(row).toEqual({ key: "delivery-domain-validation-bypass", enabled: true, updatedAt: "now", updatedBy: "admin-1" });
  });

  it("mapMatchEventRowFromDb maps a full match_events row into an IncomingPushEvent", () => {
    const row = mapMatchEventRowFromDb({
      event_id: "event-1", scorer_stream_id: "stream-1", device_id: "device-1", device_seq: 3,
      prev_hash: "hash-2", hash: "hash-3", payload: { type: "DELIVERY_RECORDED" },
      type: "DELIVERY_RECORDED", event_version: 1, hlc: "hlc-1", event_ordinal: 3.0,
      actor_ref: "user-1", provenance: { appVersion: "1.0" }, recorded_at: "2026-10-05T00:00:00Z",
      supersedes: null, voids: null,
    });
    expect(row.eventId).toBe("event-1");
    expect(row.streamId).toBe("stream-1");
    expect(row.deviceSeq).toBe(3);
    expect(row.eventOrdinal).toBe(3.0);
    expect(row.actorRef).toBe("user-1");
  });
});

describe("mapIncomingPushEventToInsertRow (TASK-0148)", () => {
  const fullEvent: IncomingPushEvent = {
    eventId: "event-1", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0,
    prevHash: "", hash: "hash-0", payload: { type: "DELIVERY_RECORDED" },
    type: "DELIVERY_RECORDED", eventVersion: 1, hlc: "hlc-0", eventOrdinal: 1.0,
    actorRef: "user-1", provenance: { appVersion: "1.0" }, recordedAt: "2026-10-05T00:00:00Z",
  };

  it("maps every field to its snake_case column, including server_received_at", () => {
    const row = mapIncomingPushEventToInsertRow(fullEvent, "match-1", "2026-10-05T00:00:01Z");
    expect(row).toMatchObject({
      event_id: "event-1", match_id: "match-1", scorer_stream_id: "stream-1", device_id: "device-1",
      device_seq: 0, hlc: "hlc-0", event_ordinal: 1.0, type: "DELIVERY_RECORDED", event_version: 1,
      actor_ref: "user-1", recorded_at: "2026-10-05T00:00:00Z", server_received_at: "2026-10-05T00:00:01Z",
      prev_hash: "", hash: "hash-0",
    });
  });

  it("defaults supersedes/voids to null when absent", () => {
    const row = mapIncomingPushEventToInsertRow(fullEvent, "match-1", "now");
    expect(row.supersedes).toBeNull();
    expect(row.voids).toBeNull();
  });

  it("throws a clear error when a NOT NULL wire field is missing, rather than silently inserting null", () => {
    const incomplete: IncomingPushEvent = { ...fullEvent, hlc: undefined };
    expect(() => mapIncomingPushEventToInsertRow(incomplete, "match-1", "now")).toThrow(/hlc/);
  });

  it("throws for a missing actorRef specifically", () => {
    const incomplete: IncomingPushEvent = { ...fullEvent, actorRef: undefined };
    expect(() => mapIncomingPushEventToInsertRow(incomplete, "match-1", "now")).toThrow(/actorRef/);
  });
});

describe("HydratedMatchEventStore (TASK-0148)", () => {
  it("seedKnownEventId and seedStreamHead are independent -- seeding order never corrupts the other", () => {
    const store = new HydratedMatchEventStore();
    store.seedStreamHead("stream-1", 5, "hash-5");
    store.seedKnownEventId("event-older");

    expect(store.has("event-older")).toBe(true);
    expect(store.lastConfirmedDeviceSeq("stream-1")).toBe(5);
    expect(store.lastHash("stream-1")).toBe("hash-5");
  });

  it("has() is false for an eventId never seeded as known", () => {
    const store = new HydratedMatchEventStore();
    expect(store.has("never-seen")).toBe(false);
  });

  it("insert() both updates the stream head and records the event as newly inserted", () => {
    const store = new HydratedMatchEventStore();
    store.seedStreamHead("stream-1", 5, "hash-5");

    const newEvent: IncomingPushEvent = { eventId: "event-6", streamId: "stream-1", deviceId: "device-1", deviceSeq: 6, prevHash: "hash-5", hash: "hash-6", payload: {} };
    store.insert(newEvent);

    expect(store.has("event-6")).toBe(true);
    expect(store.lastConfirmedDeviceSeq("stream-1")).toBe(6);
    expect(store.lastHash("stream-1")).toBe("hash-6");
    expect(store.getNewlyInserted()).toEqual([newEvent]);
  });

  it("a seeded-known (replayed) eventId never appears in getNewlyInserted, since insert() is never called for it", () => {
    const store = new HydratedMatchEventStore();
    store.seedKnownEventId("event-1");
    // Mirrors ingestPushBatch's own has()-short-circuit: a caller
    // recognizing a known id never calls insert() for it.
    expect(store.has("event-1")).toBe(true);
    expect(store.getNewlyInserted()).toEqual([]);
  });

  it("lastConfirmedDeviceSeq/lastHash are null for a stream with no seeded head and no inserts", () => {
    const store = new HydratedMatchEventStore();
    expect(store.lastConfirmedDeviceSeq("never-seen-stream")).toBeNull();
    expect(store.lastHash("never-seen-stream")).toBeNull();
  });
});
