import { describe, expect, it } from "vitest";
import { InMemoryMatchEventStore, type IncomingPushEvent } from "../src/sync/ingestPushBatch.js";
import { checkWriterFence, ingestPushBatchWithFenceCheck, InMemoryWriterFenceStore } from "../src/sync/writerFence.js";

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

describe("checkWriterFence (TASK-0037)", () => {
  it("a stream with no fence acquired yet accepts any asserted value", () => {
    const fences = new InMemoryWriterFenceStore();
    expect(checkWriterFence("stream-1", "fence-A", fences)).toEqual({ valid: true });
  });

  it("a matching fence is valid", () => {
    const fences = new InMemoryWriterFenceStore();
    fences.setFence("stream-1", "fence-A");
    expect(checkWriterFence("stream-1", "fence-A", fences)).toEqual({ valid: true });
  });

  it("a mismatched fence is rejected as STALE_FENCE", () => {
    const fences = new InMemoryWriterFenceStore();
    fences.setFence("stream-1", "fence-B"); // device B has since taken over
    const result = checkWriterFence("stream-1", "fence-A", fences); // device A's stale assertion
    expect(result).toEqual({ valid: false, reasonCode: "STALE_FENCE", detail: expect.any(String) });
  });
});

describe("ingestPushBatchWithFenceCheck (TASK-0037)", () => {
  // This task's own Expected Behavior: the second device's push is
  // rejected with a fence-conflict response; no automatic resolution.
  it("a stale fence rejects the ENTIRE remaining batch, not just one event", () => {
    const events = new InMemoryMatchEventStore();
    const fences = new InMemoryWriterFenceStore();
    fences.setFence("stream-1", "fence-current-holder");

    const batch = [
      event({ eventId: "e0", deviceSeq: 0 }),
      event({ eventId: "e1", deviceSeq: 1, prevHash: "h0", hash: "h1" }),
      event({ eventId: "e2", deviceSeq: 2, prevHash: "h1", hash: "h2" }),
    ];
    const outcomes = ingestPushBatchWithFenceCheck(batch, "stream-1", "fence-stale-device", events, fences);

    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((o) => o.status === "REJECTED")).toBe(true);
    expect(outcomes.every((o) => (o as { reasonCode: string }).reasonCode === "STALE_FENCE")).toBe(true);
    // None of the events reached per-event validation or storage at all.
    expect(events.has("e0")).toBe(false);
    expect(events.has("e1")).toBe(false);
    expect(events.has("e2")).toBe(false);
  });

  it("a valid fence delegates unchanged to the ordinary ingest path", () => {
    const events = new InMemoryMatchEventStore();
    const fences = new InMemoryWriterFenceStore();
    fences.setFence("stream-1", "fence-current-holder");

    const outcomes = ingestPushBatchWithFenceCheck(
      [event({ eventId: "e0", deviceSeq: 0 })],
      "stream-1",
      "fence-current-holder",
      events,
      fences,
    );
    expect(outcomes).toEqual([{ eventId: "e0", status: "ACCEPTED" }]);
    expect(events.has("e0")).toBe(true);
  });

  it("a stream that has never acquired a fence accepts a first writer's assertion and proceeds normally", () => {
    const events = new InMemoryMatchEventStore();
    const fences = new InMemoryWriterFenceStore();

    const outcomes = ingestPushBatchWithFenceCheck(
      [event({ eventId: "e0", deviceSeq: 0 })],
      "stream-1",
      "fence-first-writer",
      events,
      fences,
    );
    expect(outcomes).toEqual([{ eventId: "e0", status: "ACCEPTED" }]);
  });
});
