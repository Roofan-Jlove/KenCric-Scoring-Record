import { describe, expect, it } from "vitest";
import { InMemoryOfficialStore, type OfficialRow } from "../src/commands/officials.js";
import { InMemoryMatchOfficialStore, type MatchOfficialRow } from "../src/commands/matchOfficials.js";
import { InMemoryMatchStore, type MatchRow } from "../src/commands/matches.js";
import { InMemoryMatchEventStore } from "../src/sync/ingestPushBatch.js";
import { InMemoryWriterFenceStore } from "../src/sync/writerFence.js";
import { InMemoryFeatureFlagStore, setFeatureFlag } from "../src/commands/featureFlags.js";
import { InMemoryBattingStateStore } from "../src/validation/battingContext.js";
import { DELIVERY_DOMAIN_VALIDATION_BYPASS_FLAG_KEY, MAX_BATCH_SIZE, pushEvents, type PushEventsRequest } from "../src/sync/pushEvents.js";

function seedMatchForBatting(store: InMemoryMatchStore): MatchRow {
  const row: MatchRow = {
    id: "match-1",
    organizationId: "org-1",
    originDeviceId: "device-1",
    claimStatus: "CLAIMED",
    homeTeamId: "team-A",
    awayTeamId: "team-B",
    homeXi: ["striker-1", "non-striker-1", "incoming-1", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"],
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
    state: "IN_PROGRESS",
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

describe("pushEvents -- domain re-validation composition (TASK-0144)", () => {
  const validDeliveryPayload = { legality: "LEGAL", strikerBatterId: "striker-1", nonStrikerBatterId: "non-striker-1", bowlerId: "bowler-1", isFreeHit: false };

  it("accepts a DELIVERY_RECORDED event with a domain-valid payload", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: validDeliveryPayload }],
    });

    const result = pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("ACCEPTED");
  });

  it("rejects a DELIVERY_RECORDED event that fails a V-rule (DEAD_BALL with runEvents, V11)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const invalidPayload = { ...validDeliveryPayload, legality: "DEAD_BALL", runEvents: [{ origin: "OFF_BAT", value: 1, method: "RUN" }], deadBallReason: "x" };
    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: invalidPayload }],
    });

    const result = pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("REJECTED");
    expect(result.response.results[0].errorCode).toBe("DOMAIN_VALIDATION_FAILED");
    expect(result.response.results[0].errorDetail).toContain("V11");
  });

  it("rejects a DELIVERY_RECORDED event whose payload does not match the DeliveryInput shape", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: { nonsense: true } }],
    });

    const result = pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("REJECTED");
    expect(result.response.results[0].errorCode).toBe("DOMAIN_VALIDATION_FAILED");
  });

  it("a domain-invalid event never reaches the store, so a later event in the same batch fails its own sequence check", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const eventStore = new InMemoryMatchEventStore();
    const invalidPayload = { ...validDeliveryPayload, legality: "DEAD_BALL", runEvents: [{ origin: "OFF_BAT", value: 1, method: "RUN" }], deadBallReason: "x" };
    const request = baseRequest({
      events: [
        { eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: invalidPayload },
        { eventId: "event-1", streamId: "stream-1", deviceId: "device-1", deviceSeq: 1, prevHash: "hash-0", hash: "hash-1", payload: {} },
      ],
    });

    const result = pushEvents(request, "user-1", eventStore, new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("REJECTED");
    expect(result.response.results[1].outcome).toBe("REJECTED");
    expect(result.response.results[1].errorCode).toBe("DEVICE_SEQ_GAP");
    expect(result.response.confirmedThroughSeq).toBeNull();
  });

  it("non-DELIVERY_RECORDED events skip domain validation entirely and pass straight through", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "STRIKER_OVERRIDDEN", payload: { nonsense: true } }],
    });

    const result = pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("ACCEPTED");
  });
});

describe("pushEvents -- feature-flag bypass of domain re-validation (TASK-0145)", () => {
  const validDeliveryPayload = { legality: "LEGAL", strikerBatterId: "striker-1", nonStrikerBatterId: "non-striker-1", bowlerId: "bowler-1", isFreeHit: false };
  const invalidPayload = { ...validDeliveryPayload, legality: "DEAD_BALL", runEvents: [{ origin: "OFF_BAT", value: 1, method: "RUN" }], deadBallReason: "x" };

  it("with no featureFlagStore passed at all, validation still runs (today's behavior, unchanged)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: invalidPayload }],
    });

    const result = pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("REJECTED");
    expect(result.response.results[0].errorCode).toBe("DOMAIN_VALIDATION_FAILED");
  });

  it("a featureFlagStore with the bypass flag never set still validates (unset defaults to disabled)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const flagStore = new InMemoryFeatureFlagStore();
    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: invalidPayload }],
    });

    const result = pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1", flagStore);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("REJECTED");
  });

  it("the bypass flag explicitly set true skips domain validation -- the invalid payload is accepted", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const flagStore = new InMemoryFeatureFlagStore();
    setFeatureFlag(DELIVERY_DOMAIN_VALIDATION_BYPASS_FLAG_KEY, true, "admin-1", flagStore, "2026-10-05T00:00:00Z", "req-admin");
    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: invalidPayload }],
    });

    const result = pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1", flagStore);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("ACCEPTED");
  });

  it("the bypass flag explicitly set false validates normally", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const flagStore = new InMemoryFeatureFlagStore();
    setFeatureFlag(DELIVERY_DOMAIN_VALIDATION_BYPASS_FLAG_KEY, false, "admin-1", flagStore, "2026-10-05T00:00:00Z", "req-admin");
    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: invalidPayload }],
    });

    const result = pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1", flagStore);
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("REJECTED");
  });
});

describe("pushEvents -- real BattingContext for V8 (TASK-0147)", () => {
  const wicketPayload = (incomingBatterId: string | null) => ({
    legality: "LEGAL",
    strikerBatterId: "striker-1",
    nonStrikerBatterId: "non-striker-1",
    bowlerId: "bowler-1",
    isFreeHit: false,
    wicket: { mode: "BOWLED", outBatterId: "striker-1", endVacated: "STRIKER", incomingBatterId },
  });

  it("with no battingContextDeps passed, a wicket naming an incoming batter is rejected (today's TASK-0144 behavior, unchanged)", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: wicketPayload("incoming-1") }],
    });

    const result = pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1");
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("REJECTED");
    expect(result.response.results[0].errorDetail).toContain("V8");
  });

  it("with battingContextDeps passed and the innings seeded, a valid incoming batter is accepted", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const matchStore = new InMemoryMatchStore();
    seedMatchForBatting(matchStore);
    const battingStateStore = new InMemoryBattingStateStore();
    battingStateStore.seed("match-1", "team-A");

    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: wicketPayload("incoming-1") }],
    });

    const result = pushEvents(
      request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1",
      undefined, { matchStore, store: battingStateStore },
    );
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("ACCEPTED");
  });

  it("an incoming batter already dismissed earlier in the innings is rejected by V8", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const matchStore = new InMemoryMatchStore();
    seedMatchForBatting(matchStore);
    const battingStateStore = new InMemoryBattingStateStore();
    battingStateStore.seed("match-1", "team-A");
    battingStateStore.recordDismissal("match-1", "incoming-1");

    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: wicketPayload("incoming-1") }],
    });

    const result = pushEvents(
      request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1",
      undefined, { matchStore, store: battingStateStore },
    );
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("REJECTED");
    expect(result.response.results[0].errorDetail).toContain("V8");
  });

  it("an accepted wicket folds outBatterId into the dismissed set, rejecting it as a LATER incoming batter in the same batch", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const matchStore = new InMemoryMatchStore();
    seedMatchForBatting(matchStore);
    const battingStateStore = new InMemoryBattingStateStore();
    battingStateStore.seed("match-1", "team-A");

    const request = baseRequest({
      events: [
        { eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: wicketPayload("incoming-1") },
        {
          eventId: "event-1", streamId: "stream-1", deviceId: "device-1", deviceSeq: 1, prevHash: "hash-0", hash: "hash-1", type: "DELIVERY_RECORDED",
          payload: {
            legality: "LEGAL", strikerBatterId: "incoming-1", nonStrikerBatterId: "non-striker-1", bowlerId: "bowler-1", isFreeHit: false,
            wicket: { mode: "BOWLED", outBatterId: "non-striker-1", endVacated: "NON_STRIKER", incomingBatterId: "striker-1" },
          },
        },
      ],
    });

    const result = pushEvents(
      request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1",
      undefined, { matchStore, store: battingStateStore },
    );
    expect(result.outcome).toBe("ok");
    if (result.outcome !== "ok") throw new Error("unreachable");
    expect(result.response.results[0].outcome).toBe("ACCEPTED");
    expect(result.response.results[1].outcome).toBe("REJECTED");
    expect(result.response.results[1].errorDetail).toContain("V8");
  });

  it("a REJECTED wicket (e.g. domain-invalid) does not fold its outBatterId into the dismissed set", () => {
    const { officialStore, matchOfficialStore } = setUpAuthorizedScorer();
    const matchStore = new InMemoryMatchStore();
    seedMatchForBatting(matchStore);
    const battingStateStore = new InMemoryBattingStateStore();
    battingStateStore.seed("match-1", "team-A");

    const request = baseRequest({
      events: [{ eventId: "event-0", streamId: "stream-1", deviceId: "device-1", deviceSeq: 0, prevHash: "", hash: "hash-0", type: "DELIVERY_RECORDED", payload: wicketPayload("not-in-xi") }],
    });

    pushEvents(request, "user-1", new InMemoryMatchEventStore(), new InMemoryWriterFenceStore(), officialStore, matchOfficialStore, "req-1", undefined, { matchStore, store: battingStateStore });

    expect(battingStateStore.get("match-1")?.dismissedPlayerIds.has("striker-1")).toBe(false);
  });
});
