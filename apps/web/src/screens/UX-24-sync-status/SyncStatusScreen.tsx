import { deriveSyncStatus, formatRejectionMessage, rejectedOutcomes, type PushEventOutcome, type SyncStateInputs } from "./syncStatusState";

/**
 * TASK-0083: `ux-specification.md UX-24` -- Sync Status. Styling not
 * applied, same scope boundary as every earlier screen this session.
 * `globalQueueDepth`/`lastFullSyncTimestamp` are caller-supplied
 * display values.
 *
 * `UX-24`'s own Accessibility text: "each error-list entry's accessible
 * name states the ball reference and the problem plainly" -- but the
 * reused `PushEventOutcome` shape (`shared/`'s own `PushBatcher.kt`)
 * carries only an `eventId`, not a ball reference; `eventBallReference`
 * is a caller-supplied lookup rather than a fabricated one, flagging
 * this real gap between the reused sync shape and the screen's own
 * accessibility requirement instead of silently dropping it.
 */

export interface SyncStatusScreenProps extends SyncStateInputs {
  outcomes: readonly PushEventOutcome[];
  eventBallReference: (eventId: string) => string | null;
  globalQueueDepth: number;
  lastFullSyncTimestamp: string | null;
  hasNeverSynced: boolean;
  onTriggerManualSync: () => void;
  onRetryFailedBatch: () => void;
  onViewEventDetail: (eventId: string) => void;
  onSignIn: () => void;
}

function statusLabel(status: ReturnType<typeof deriveSyncStatus>): string {
  switch (status) {
    case "IDLE_SYNCED":
      return "Synced";
    case "SYNCING":
      return "Syncing";
    case "PARTIAL_FAILURE":
      return "Some items failed to sync";
    case "FULLY_OFFLINE":
      return "Offline — queue frozen";
    case "BACKEND_DEGRADED":
      return "Server unreachable — data queued safely";
  }
}

export function SyncStatusScreen({
  outcomes,
  eventBallReference,
  globalQueueDepth,
  lastFullSyncTimestamp,
  hasNeverSynced,
  onTriggerManualSync,
  onRetryFailedBatch,
  onViewEventDetail,
  onSignIn,
  ...syncInputs
}: SyncStatusScreenProps) {
  if (hasNeverSynced) {
    return (
      <div>
        <p>Sign in to enable cloud sync and back up your matches automatically.</p>
        <button type="button" onClick={onSignIn}>
          Sign in
        </button>
      </div>
    );
  }

  const status = deriveSyncStatus(syncInputs);
  const rejected = rejectedOutcomes(outcomes);

  return (
    <div>
      <p role="status">{statusLabel(status)}</p>
      <p>Queue depth: {globalQueueDepth}</p>
      <p>Last full sync: {lastFullSyncTimestamp ?? "Never"}</p>

      <button type="button" onClick={onTriggerManualSync}>
        Sync now
      </button>

      {rejected.length > 0 && (
        <div>
          <button type="button" onClick={onRetryFailedBatch}>
            Retry failed batch
          </button>
          <ul aria-label="Rejected events">
            {rejected.map((outcome) => {
              const ballReference = eventBallReference(outcome.eventId);
              const message = formatRejectionMessage(outcome.rejectionReason);
              const accessibleName = ballReference !== null ? `Over ${ballReference}: ${message}` : message;
              return (
                <li key={outcome.eventId}>
                  <button type="button" aria-label={accessibleName} onClick={() => onViewEventDetail(outcome.eventId)}>
                    {accessibleName}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
