import { describe, expect, it } from "vitest";
import { deriveConnectivityStatus, statusIconLabel, statusMessage, type ConnectivityStateInputs } from "./connectivityState";

function baseInputs(overrides: Partial<ConnectivityStateInputs> = {}): ConnectivityStateInputs {
  return { isOnline: true, isBackendReachable: true, isSyncing: false, queuedCount: 0, ...overrides };
}

describe("deriveConnectivityStatus", () => {
  it("ONLINE_SYNCED when online, backend reachable, not syncing, nothing queued", () => {
    expect(deriveConnectivityStatus(baseInputs())).toBe("ONLINE_SYNCED");
  });

  it("ONLINE_SYNCING when online and actively syncing", () => {
    expect(deriveConnectivityStatus(baseInputs({ isSyncing: true }))).toBe("ONLINE_SYNCING");
  });

  it("OFFLINE_WITH_QUEUE when offline with items pending", () => {
    expect(deriveConnectivityStatus(baseInputs({ isOnline: false, queuedCount: 3 }))).toBe("OFFLINE_WITH_QUEUE");
  });

  it("OFFLINE_CAUGHT_UP when offline with nothing pending", () => {
    expect(deriveConnectivityStatus(baseInputs({ isOnline: false, queuedCount: 0 }))).toBe("OFFLINE_CAUGHT_UP");
  });

  // NFR-014: backend degradation is distinguished from true offline.
  it("BACKEND_DEGRADED when online but the backend is not reachable", () => {
    expect(deriveConnectivityStatus(baseInputs({ isOnline: true, isBackendReachable: false }))).toBe("BACKEND_DEGRADED");
  });

  it("BACKEND_DEGRADED takes priority even while queued items exist", () => {
    expect(deriveConnectivityStatus(baseInputs({ isOnline: true, isBackendReachable: false, queuedCount: 5 }))).toBe(
      "BACKEND_DEGRADED",
    );
  });
});

describe("statusMessage -- distinct copy for offline vs. backend-degraded", () => {
  it("uses the exact quoted phrasing for a genuine offline queue", () => {
    expect(statusMessage("OFFLINE_WITH_QUEUE")).toBe("You're offline — carry on, we'll sync later");
  });

  it("uses distinct phrasing for a backend-degraded state, not the offline copy", () => {
    const degraded = statusMessage("BACKEND_DEGRADED");
    expect(degraded).not.toBe(statusMessage("OFFLINE_WITH_QUEUE"));
    expect(degraded).toContain("trouble reaching the server");
  });
});

describe("statusIconLabel -- never color-only", () => {
  it("gives a distinct icon label per status, always alongside text", () => {
    expect(statusIconLabel("ONLINE_SYNCED")).toBe("cloud");
    expect(statusIconLabel("OFFLINE_WITH_QUEUE")).toBe("cloud-off");
    expect(statusIconLabel("BACKEND_DEGRADED")).toBe("cloud-alert");
  });
});
