/**
 * TASK-0083: `ux-specification.md UX-24` -- Sync Status, sync-state-
 * derivation layer.
 *
 * `PushEventOutcome`/`PushOutcomeStatus` mirror `shared/`'s existing
 * `core/sync/PushBatcher.kt` (`TASK-0035`) field-for-field -- exactly
 * the per-event error data this screen's "View error detail for a
 * rejected event" action needs, reused not reinvented.
 *
 * CITATION NOTE: `SYNC-001/005/006` are an SRS-native consolidated
 * series (per the SRS's own §10 intro), not a discovery/SRS collision
 * -- `SYNC-*` has no discovery-level shadow. `AUD-013` is a real but
 * loosely-fitting citation, broader than this screen's own concern.
 *
 * A deliberate design choice, not reuse-by-default: despite the
 * conceptual overlap with `TASK-0081`'s `ConnectivityStatus`, this
 * screen builds its own distinct `SyncStatus` enum -- the two screens'
 * own States lists genuinely differ (`PARTIAL_FAILURE` has no `UX-23`
 * equivalent).
 */

export type PushOutcomeStatus = "ACCEPTED" | "REJECTED";

export interface PushEventOutcome {
  eventId: string;
  status: PushOutcomeStatus;
  rejectionReason: string | null;
}

export type SyncStatus = "IDLE_SYNCED" | "SYNCING" | "PARTIAL_FAILURE" | "FULLY_OFFLINE" | "BACKEND_DEGRADED";

export interface SyncStateInputs {
  isOnline: boolean;
  isBackendReachable: boolean;
  isSyncing: boolean;
  rejectedCount: number;
}

/**
 * `UX-24`'s own States: "Idle-synced · Syncing (progress + event count)
 * · Partial-failure (rejected events itemised) · Fully-offline (queue
 * frozen, explained) · Backend-degraded (distinguished from offline,
 * §2.4)." `BACKEND_DEGRADED` checked first, then `FULLY_OFFLINE`, then
 * `PARTIAL_FAILURE` (rejected events need explicit action, so they take
 * priority over an in-progress sync), then `SYNCING`.
 */
export function deriveSyncStatus(inputs: SyncStateInputs): SyncStatus {
  if (inputs.isOnline && !inputs.isBackendReachable) return "BACKEND_DEGRADED";
  if (!inputs.isOnline) return "FULLY_OFFLINE";
  if (inputs.rejectedCount > 0) return "PARTIAL_FAILURE";
  return inputs.isSyncing ? "SYNCING" : "IDLE_SYNCED";
}

export function rejectedOutcomes(outcomes: readonly PushEventOutcome[]): PushEventOutcome[] {
  return outcomes.filter((o) => o.status === "REJECTED");
}

/** `UX-24`'s own Error-handling text: "Every rejected event shows the specific reason in plain language... never a raw error code." */
export function formatRejectionMessage(rejectionReason: string | null): string {
  if (rejectionReason === null) {
    return "This item couldn't be synced — please review it";
  }
  return `This item couldn't be synced: ${rejectionReason}`;
}
