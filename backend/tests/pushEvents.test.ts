import { describe, expect, it } from "vitest";
import { InMemoryOfficialStore, type OfficialRow } from "../src/commands/officials.js";
import { InMemoryMatchOfficialStore, type MatchOfficialRow } from "../src/commands/matchOfficials.js";
import { InMemoryMatchEventStore } from "../src/sync/ingestPushBatch.js";
import { InMemoryWriterFenceStore } from "../src/sync/writerFence.js";
import { MAX_BATCH_SIZE, pushEvents, type PushEventsRequest } from "../src/sync/pushEvents.js";

function seedOfficial(store: InMemoryOfficialStore, id: string, userId: string | null): OfficialRow {
  const row: OfficialRow = {
    id,
    organizationId: "org-1",
    userId,
    name: id,
    rowVersion: 1,
    createdAt: "2026-10-01T00:00:00Z",
    createdBy: "admin-1",
    updatedAt: "2026-10-01T00:00:00Z",
    updatedBy: "admin-1",
  };
  store.insert(row);
  return row;
}

function seedMatchOfficial(store: InMemoryMatchOfficialStore, matchId: string, officialId: string, role: MatchOfficialRow["role"]): void {
  store.upsert({ matchId, officialId, role, createdAt: "2026-10-01T00:00:00Z", createdBy: "admin-1" });
}

function baseRequest(overrides: Partial<PushEventsRequest> = {}): PushEventsRequest {
  return {
    matchId: "match-1",
    scorerStreamId: "stream-1",
    deviceId: "device-1",
    fenceValue: "fence-1",
    events: [
      { eventId: "event-1", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", payload: { type: "DELIVERY_RECORDED" } },
    ],
    ...overrides,
  };
}

function setUpAuthorizedScorer(role: "HEAD_SCORER" | "ASSISTANT_SCORER" = "HEAD_SCORER") {
  const officialStore = new InMemoryOfficialStore();
  const matchOfficialStore = new InMemoryMatchOfficialStore();
  seedOfficial(officialStore, "official-1", "user-1");
  seedMatchOfficial(matchOfficialStore, "match-1", "official-1", role);
  return { officialStore, matchOfficialStore };
}

describe("pushEvents (TASK-0143)", () => {
  it("accepts a valid batch from an authorized Head Scorer", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer("HEAD_SCORER");
    const eventStore = new InMemoryMatchEventStore();
    const fenceStore = new InMemoryWriterFenceStore();

    const result = pushEvents(baseRequest(), "user-1", eventStore, fenceStore, officialStore, matchOfficialStore, "req-1");

    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results).toEqual([{ eventId: "event-1", outcome: "ACCEPTED", newHighWaterSeq: 0 }]);
    expect(result.response.confirmedThroughSeq).toBe(0);
  });

  it("accepts a valid batch from an authorized Assistant Scorer too", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer("ASSISTANT_SCORER");
    const eventStore = new InMemoryMatchEventStore();
    const fenceStore = new InMemoryWriterFenceStore();

    const result = pushEvents(baseRequest(), "user-1", eventStore, fenceStore, officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
  });

  it("missing matchId is a schema failure (400)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const result = pushEvents(baseRequest({ matchId: undefined }), "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing scorerStreamId is a schema failure (400)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const result = pushEvents(baseRequest({ scorerStreamId: undefined }), "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing deviceId is a schema failure (400)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const result = pushEvents(baseRequest({ deviceId: undefined }), "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing fenceValue is a schema failure (400)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const result = pushEvents(baseRequest({ fenceValue: undefined }), "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing events is a schema failure (400)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const result = pushEvents(baseRequest({ events: undefined }), "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("a batch over the maximum size is a schema failure (400)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const tooMany = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => ({
      eventId: `event-${i}`, streamId: "stream-1", deviceId: "device-1", deviceSeq: i, prevHash: "", hash: `hash-${i}`, payload: {},
    }));
    const result = pushEvents(baseRequest({ events: tooMany }), "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("rejects a user with no linked official record (403)", () => {
    const officialStore = new InMemoryOfficialStore();
    const matchOfficialStore = new InMemoryMatchOfficialStore();
    const result = pushEvents(baseRequest(), "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(403);
  });

  it("rejects a linked official who is not assigned Head/Assistant Scorer on this match (403)", () => {
    const officialStore = new InMemoryOfficialStore();
    const matchOfficialStore = new InMemoryMatchOfficialStore();
    seedOfficial(officialStore, "official-1", "user-1");
    seedMatchOfficial(matchOfficialStore, "match-1", "official-1", "UMPIRE");

    const result = pushEvents(baseRequest(), "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(403);
  });

  it("rejects a scorer assigned on a DIFFERENT match (403)", () => {
    const officialStore = new InMemoryOfficialStore();
    const matchOfficialStore = new InMemoryMatchOfficialStore();
    seedOfficial(officialStore, "official-1", "user-1");
    seedMatchOfficial(matchOfficialStore, "match-other", "official-1", "HEAD_SCORER");

    const result = pushEvents(baseRequest(), "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(403);
  });

  it("a stale fence rejects the entire batch, confirmedThroughSeq stays null", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const fenceStore = new InMemoryWriterFenceStore();
    fenceStore.setFence("stream-1", "fence-OLD");

    const result = pushEvents(baseRequest({ fenceValue: "fence-NEW" }), "user-1", new InMemoryMatchEventStore(), fenceStore, officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("REJECTED");
    expect(result.response.results[0].errorCode).toBe("STALE_FENCE");
    expect(result.response.confirmedThroughSeq).toBeNull();
  });

  it("confirmedThroughSeq advances only through the contiguous accepted prefix, stopping at the first gap", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const eventStore = new InMemoryMatchEventStore();
    const fenceStore = new InMemoryWriterFenceStore();

    const request = baseRequest({
      events: [
        { eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", payload: {} },
        { eventId: "event-2", streamId: "stream-1", deviceId: "device-1", deviceSeq: 2, prevHash: "hash-0", hash: "hash-2", payload: {} },
      ],
    });

    const result = pushEvents(request, "user-1", eventStore, fenceStore, officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("ACCEPTED");
    expect(result.response.results[1].outcome).toBe("REJECTED");
    expect(result.response.results[1].errorCode).toBe("DEVICE_SEQ_GAP");
    expect(result.response.confirmedThroughSeq).toBe(0);
  });

  it("accepts a full multi-event contiguous batch, confirmedThroughSeq reaches the last one", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const eventStore = new InMemoryMatchEventStore();
    const fenceStore = new InMemoryWriterFenceStore();

    const request = baseRequest({
      events: [
        { eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", payload: {} },
        { eventId: "event-1", streamId: "stream-1", deviceId: "device-1", deviceSeq: 1, prevHash: "hash-0", hash: "hash-1", payload: {} },
      ],
    });

    const result = pushEvents(request, "user-1", eventStore, fenceStore, officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.confirmedThroughSeq).toBe(1);
  });

  it("re-submitting an already-accepted event replays the identical ACCEPTED outcome", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const eventStore = new InMemoryMatchEventStore();
    const fenceStore = new InMemoryWriterFenceStore();

    pushEvents(baseRequest(), "user-1", eventStore, fenceStore, officialStore, matchOfficialStore, "req-1");
    const second = pushEvents(baseRequest(), "user-1", eventStore, fenceStore, officialStore, matchOfficialStore, "req-2");

    expect(second.outcome).toBe("ok");
    if (second.outcome !== "ok") throw new Error("unreachable");
    expect(second.response.results[0].outcome).toBe("ACCEPTED");
  });
});
