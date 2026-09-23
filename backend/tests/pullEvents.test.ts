import { describe, expect, it } from "vitest";
import { InMemoryMatchEventStore, type IncomingPushEvent } from "../src/sync/ingestPushBatch.js";
import { pullEvents } from "../src/sync/pullEvents.js";

function event(overrides: Partial<IncomingPushEvent> = {}): IncomingPushEvent {
  return {
    eventId: "e0",
    streamId: "stream-1",
    deviceId: "device-1",
    deviceSeq: 0,
    prevHash: "genesis",
    hash: "h0",
    payload: { legality: "LEGAL" },
    ...overrides,
  };
}

describe("pullEvents (TASK-0036)", () => {
  it("a null cursor returns every event for the stream, in ordinal order", () => {
    const store = new InMemoryMatchEventStore();
    store.insert(event({ eventId: "e0" }));
    store.insert(event({ eventId: "e1", deviceSeq: 1, prevHash: "h0", hash: "h1" }));

    const pulled = pullEvents(store, "stream-1", null);
    expect(pulled.map((e) => e.eventId)).toEqual(["e0", "e1"]);
    expect(pulled[0].eventOrdinal).toBeLessThan(pulled[1].eventOrdinal);
  });

  it("a cursor returns only events strictly after it", () => {
    const store = new InMemoryMatchEventStore();
    store.insert(event({ eventId: "e0" }));
    store.insert(event({ eventId: "e1", deviceSeq: 1, prevHash: "h0", hash: "h1" }));
    store.insert(event({ eventId: "e2", deviceSeq: 2, prevHash: "h1", hash: "h2" }));

    const firstOrdinal = pullEvents(store, "stream-1", null)[0].eventOrdinal;
    const pulled = pullEvents(store, "stream-1", firstOrdinal);
    expect(pulled.map((e) => e.eventId)).toEqual(["e1", "e2"]);
  });

  it("events from a different stream are never returned", () => {
    const store = new InMemoryMatchEventStore();
    store.insert(event({ eventId: "a0", streamId: "stream-A" }));
    store.insert(event({ eventId: "b0", streamId: "stream-B" }));

    const pulled = pullEvents(store, "stream-A", null);
    expect(pulled.map((e) => e.eventId)).toEqual(["a0"]);
  });

  // This task's own Expected Behavior: reconnecting after an arbitrary
  // offline duration pulls exactly the events after the stored cursor
  // -- no gaps, no duplicates, across two separate pull calls.
  it("reconnecting after an offline gap resumes with no gaps or duplicates", () => {
    const store = new InMemoryMatchEventStore();
    store.insert(event({ eventId: "e0" }));
    store.insert(event({ eventId: "e1", deviceSeq: 1, prevHash: "h0", hash: "h1" }));

    const firstPull = pullEvents(store, "stream-1", null);
    const cursorAfterFirst = firstPull[firstPull.length - 1].eventOrdinal;

    // Simulated "arbitrary offline duration": more events land on the
    // server before this device pulls again.
    store.insert(event({ eventId: "e2", deviceSeq: 2, prevHash: "h1", hash: "h2" }));
    store.insert(event({ eventId: "e3", deviceSeq: 3, prevHash: "h2", hash: "h3" }));

    const secondPull = pullEvents(store, "stream-1", cursorAfterFirst);
    expect(secondPull.map((e) => e.eventId)).toEqual(["e2", "e3"]);

    // The union across both pulls is exactly the four events, once each.
    const allPulledIds = [...firstPull, ...secondPull].map((e) => e.eventId);
    expect(new Set(allPulledIds).size).toBe(4);
    expect(allPulledIds).toEqual(["e0", "e1", "e2", "e3"]);
  });

  it("interleaved inserts across streams preserve each stream's own relative ordinal order", () => {
    const store = new InMemoryMatchEventStore();
    store.insert(event({ eventId: "a0", streamId: "stream-A" }));
    store.insert(event({ eventId: "b0", streamId: "stream-B" }));
    store.insert(event({ eventId: "a1", streamId: "stream-A", deviceSeq: 1, prevHash: "h0", hash: "ha1" }));

    const pulledA = pullEvents(store, "stream-A", null);
    expect(pulledA.map((e) => e.eventId)).toEqual(["a0", "a1"]);
  });

  it("an empty store returns an empty pull", () => {
    const store = new InMemoryMatchEventStore();
    expect(pullEvents(store, "stream-1", null)).toEqual([]);
  });
});
