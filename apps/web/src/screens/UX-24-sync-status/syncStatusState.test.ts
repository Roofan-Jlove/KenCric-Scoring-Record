import { describe, expect, it } from "vitest";
import { deriveSyncStatus, formatRejectionMessage, rejectedOutcomes, type PushEventOutcome, type SyncStateInputs } from "./syncStatusState";

function baseInputs(overrides: Partial<SyncStateInputs> = {}): SyncStateInputs {
  return { isOnline: true, isBackendReachable: true, isSyncing: false, rejectedCount: 0, ...overrides };
}

describe("deriveSyncStatus", () => {
  it("IDLE_SYNCED when online, reachable, not syncing, nothing rejected", () => {
    expect(deriveSyncStatus(baseInputs())).toBe("IDLE_SYNCED");
  });

  it("SYNCING when online and actively syncing with no rejections", () => {
    expect(deriveSyncStatus(baseInputs({ isSyncing: true }))).toBe("SYNCING");
  });

  it("PARTIAL_FAILURE when any event is rejected, taking priority over an in-progress sync", () => {
    expect(deriveSyncStatus(baseInputs({ isSyncing: true, rejectedCount: 1 }))).toBe("PARTIAL_FAILURE");
  });

  it("FULLY_OFFLINE when offline, regardless of rejected count", () => {
    expect(deriveSyncStatus(baseInputs({ isOnline: false, rejectedCount: 2 }))).toBe("FULLY_OFFLINE");
  });

  // "distinguished from offline"
  it("BACKEND_DEGRADED when online but the backend is not reachable", () => {
    expect(deriveSyncStatus(baseInputs({ isBackendReachable: false }))).toBe("BACKEND_DEGRADED");
  });

  it("BACKEND_DEGRADED takes priority over everything else", () => {
    expect(deriveSyncStatus(baseInputs({ isBackendReachable: false, isSyncing: true, rejectedCount: 3 }))).toBe(
      "BACKEND_DEGRADED",
    );
  });
});

describe("rejectedOutcomes", () => {
  const outcomes: PushEventOutcome[] = [
    { eventId: "e1", status: "ACCEPTED", rejectionReason: null },
    { eventId: "e2", status: "REJECTED", rejectionReason: "Validation failed" },
  ];

  it("filters to just the rejected entries", () => {
    expect(rejectedOutcomes(outcomes)).toEqual([{ eventId: "e2", status: "REJECTED", rejectionReason: "Validation failed" }]);
  });

  it("returns an empty list when nothing was rejected", () => {
    expect(rejectedOutcomes([{ eventId: "e1", status: "ACCEPTED", rejectionReason: null }])).toEqual([]);
  });
});

describe("formatRejectionMessage -- plain language, never a raw error code", () => {
  it("wraps a known reason in a plain-language sentence", () => {
    expect(formatRejectionMessage("Validation failed")).toBe("This item couldn't be synced: Validation failed");
  });

  it("falls back to a generic plain-language message when no reason is given", () => {
    expect(formatRejectionMessage(null)).toBe("This item couldn't be synced — please review it");
  });
});
