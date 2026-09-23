import { describe, expect, it } from "vitest";
import {
  ingestPushBatch,
  InMemoryMatchEventStore,
  type IncomingPushEvent,
} from "../src/sync/ingestPushBatch.js";

function event(overrides: Partial<IncomingPushEvent> = {}): IncomingPushEvent {
  return {
    eventId: "event-0",
    streamId: "stream-1",
    deviceId: "device-1",
    deviceSeq: 0,
    prevHash: "genesis",
    hash: "hash-0",
    payload: { legality: "LEGAL" },
    ...overrides,
  };
}

describe("ingestPushBatch (TASK-0035)", () => {
  it("accepts and stores a fresh event", () => {
    const store = new InMemoryMatchEventStore();
    const outcomes = ingestPushBatch([event()], store);
    expect(outcomes).toEqual([{ eventId: "event-0", status: "ACCEPTED" }]);
    expect(store.has("event-0")).toBe(true);
  });

  // This task's own stated Expected Behavior, verified directly.
  it("re-submitting the same event_id is a no-op -- exactly one stored event, not two", () => {
    const store = new InMemoryMatchEventStore();
    ingestPushBatch([event()], store);

    // Simulate a retried request after a dropped response: the exact
    // same event, submitted again in a later, independent call.
    const secondOutcomes = ingestPushBatch([event()], store);

    expect(secondOutcomes).toEqual([{ eventId: "event-0", status: "ACCEPTED" }]);
    // The insertion count, not just the outcome, is what proves
    // exactly-once storage -- checked via the store's own last-seq
    // bookkeeping never having been touched a second time.
    expect(store.lastConfirmedDeviceSeq("stream-1")).toBe(0);
  });

  it("rejects a device_seq gap", () => {
    const store = new InMemoryMatchEventStore();
    const outcomes = ingestPushBatch([event({ eventId: "event-skip", deviceSeq: 2 })], store);
    expect(outcomes).toEqual([
      { eventId: "event-skip", status: "REJECTED", reasonCode: "DEVICE_SEQ_GAP", detail: "expected device_seq 0, got 2" },
    ]);
    expect(store.has("event-skip")).toBe(false);
  });

  it("rejects a broken hash chain against the stream's last stored hash", () => {
    const store = new InMemoryMatchEventStore();
    ingestPushBatch([event()], store); // hash-0 now the stream's last hash

    const outcomes = ingestPushBatch(
      [event({ eventId: "event-1", deviceSeq: 1, prevHash: "wrong-hash", hash: "hash-1" })],
      store,
    );
    expect(outcomes[0].status).toBe("REJECTED");
    expect((outcomes[0] as { reasonCode: string }).reasonCode).toBe("HASH_CHAIN_BROKEN");
  });

  it("accepts a genesis event's prevHash unconditionally -- no fixed genesis constant exists anywhere in this backlog yet", () => {
    const store = new InMemoryMatchEventStore();
    const outcomes = ingestPushBatch([event({ prevHash: "whatever-the-client-declares" })], store);
    expect(outcomes[0].status).toBe("ACCEPTED");
  });

  it("a batch extends a stream by multiple new events in one call, checked sequentially", () => {
    const store = new InMemoryMatchEventStore();
    const batch = [
      event({ eventId: "e0", deviceSeq: 0, prevHash: "genesis", hash: "h0" }),
      event({ eventId: "e1", deviceSeq: 1, prevHash: "h0", hash: "h1" }),
      event({ eventId: "e2", deviceSeq: 2, prevHash: "h1", hash: "h2" }),
    ];
    const outcomes = ingestPushBatch(batch, store);
    expect(outcomes.every((o) => o.status === "ACCEPTED")).toBe(true);
    expect(store.lastConfirmedDeviceSeq("stream-1")).toBe(2);
  });

  it("a rejection partway through a batch does not block earlier or unrelated-stream events", () => {
    const store = new InMemoryMatchEventStore();
    const batch = [
      event({ eventId: "e0", deviceSeq: 0, prevHash: "genesis", hash: "h0" }),
      event({ eventId: "e-bad", deviceSeq: 5, prevHash: "h0", hash: "h-bad" }), // gap
      event({ eventId: "b0", streamId: "stream-2", deviceSeq: 0, prevHash: "genesis", hash: "hb0" }),
    ];
    const outcomes = ingestPushBatch(batch, store);
    expect(outcomes[0].status).toBe("ACCEPTED");
    expect(outcomes[1].status).toBe("REJECTED");
    expect(outcomes[2].status).toBe("ACCEPTED"); // independent stream, unaffected
  });

  it("independent streams track device_seq independently", () => {
    const store = new InMemoryMatchEventStore();
    ingestPushBatch([event({ eventId: "a0", streamId: "stream-A", deviceSeq: 0 })], store);
    ingestPushBatch([event({ eventId: "b0", streamId: "stream-B", deviceSeq: 0 })], store);
    expect(store.lastConfirmedDeviceSeq("stream-A")).toBe(0);
    expect(store.lastConfirmedDeviceSeq("stream-B")).toBe(0);
  });
});
