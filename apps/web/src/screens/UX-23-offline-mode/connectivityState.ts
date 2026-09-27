/**
 * TASK-0081: `ux-specification.md UX-23` -- Offline Mode, connectivity-
 * state-derivation layer.
 *
 * `shared/`'s existing `core/sync/OutboxState.kt`'s own `pending()`
 * function (`TASK-0034`) gives exactly the "queued-item count" this
 * screen needs -- reused, not reinvented (the Android port genuinely
 * imports it; this web mirror accepts the count as a plain number since
 * `OutboxState` carries event-log data this display screen has no other
 * use for).
 *
 * CITATION NOTE: `UX-23`'s Trace `OFF-021/022` uses SRS's own separate
 * "OFF-*" requirements series (`software-requirements-specification.md
 * §9`, distinct from the `FR-*`/`BR-*` series AND discovery's own
 * `OFR-*` series -- three numbering systems in this corpus). `OFF-021`
 * ("Always-visible connectivity and last-synced state," tracing to
 * discovery `OFR-022`) correctly matches. `OFF-022` ("Guest-mode
 * offline scoring") does NOT match this screen's scope at all -- a
 * genuine citation error, not a namespace collision. `OFF-023` (the
 * non-blocking reachability-check requirement, describing this screen's
 * own "Manually retry a connection check" action almost verbatim per
 * `offline-first-specification.md`'s own body text) is referenced in
 * prose but has no formal numbered definition entry anywhere, and isn't
 * even in `UX-23`'s own Trace despite being more directly on-topic than
 * the cited `OFF-022`.
 */

export type ConnectivityStatus = "ONLINE_SYNCED" | "ONLINE_SYNCING" | "OFFLINE_WITH_QUEUE" | "OFFLINE_CAUGHT_UP" | "BACKEND_DEGRADED";

export interface ConnectivityStateInputs {
  isOnline: boolean;
  isBackendReachable: boolean;
  isSyncing: boolean;
  queuedCount: number;
}

/**
 * `UX-23`'s own States: "Online-synced · Online-syncing · Offline-with-
 * queue · Offline-caught-up (nothing pending) · Backend-degraded (server
 * reachable but erroring -- distinguished from true offline)."
 * Backend-degraded is checked first (`NFR-014`: "Backend degradation
 * never blocks offline scoring") -- a genuinely degraded backend while
 * nominally online is distinct from true offline.
 */
export function deriveConnectivityStatus(inputs: ConnectivityStateInputs): ConnectivityStatus {
  if (inputs.isOnline && !inputs.isBackendReachable) return "BACKEND_DEGRADED";
  if (!inputs.isOnline) {
    return inputs.queuedCount > 0 ? "OFFLINE_WITH_QUEUE" : "OFFLINE_CAUGHT_UP";
  }
  return inputs.isSyncing ? "ONLINE_SYNCING" : "ONLINE_SYNCED";
}

/**
 * `UX-23`'s own Error-handling text: "True offline and backend-degraded
 * use distinct copy, because the right user action differs" -- the two
 * quoted phrasings, verbatim.
 */
export function statusMessage(status: ConnectivityStatus): string {
  switch (status) {
    case "ONLINE_SYNCED":
      return "Online — all caught up";
    case "ONLINE_SYNCING":
      return "Online — syncing";
    case "OFFLINE_WITH_QUEUE":
      return "You're offline — carry on, we'll sync later";
    case "OFFLINE_CAUGHT_UP":
      return "You're offline — all caught up";
    case "BACKEND_DEGRADED":
      return "We're having trouble reaching the server — your data is safe and queued";
  }
}

/** `UX-23`'s own Accessibility text: "Never color-only (icon + text, e.g. a crossed-out cloud plus 'Offline')." A text label, not a literal glyph -- the actual icon asset is a UI-layer concern. */
export function statusIconLabel(status: ConnectivityStatus): string {
  switch (status) {
    case "ONLINE_SYNCED":
    case "ONLINE_SYNCING":
      return "cloud";
    case "OFFLINE_WITH_QUEUE":
    case "OFFLINE_CAUGHT_UP":
      return "cloud-off";
    case "BACKEND_DEGRADED":
      return "cloud-alert";
  }
}
