import { useState } from "react";
import { deriveConnectivityStatus, statusIconLabel, statusMessage, type ConnectivityStateInputs } from "./connectivityState";

/**
 * TASK-0081: `ux-specification.md UX-23` -- Offline Mode. Styling not
 * applied, same scope boundary as every earlier screen this session.
 * `lastSyncedTime`/`storageUsageLabel` are caller-supplied display
 * strings -- formatting those is outside this screen's own derivation
 * scope.
 */

export interface OfflineModeIndicatorProps extends ConnectivityStateInputs {
  lastSyncedTime: string | null;
  storageUsageLabel: string;
  onRetryConnection: () => void;
  onJumpToSyncStatus: () => void;
  onManageStorage: () => void;
}

export function OfflineModeIndicator({
  lastSyncedTime,
  storageUsageLabel,
  onRetryConnection,
  onJumpToSyncStatus,
  onManageStorage,
  ...connectivityInputs
}: OfflineModeIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const status = deriveConnectivityStatus(connectivityInputs);

  return (
    <div>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
        <span aria-hidden="true">{statusIconLabel(status)}</span>
        <span aria-live="polite">{statusMessage(status)}</span>
      </button>

      {expanded && (
        <div aria-label="Connectivity detail">
          <p>Last synced: {lastSyncedTime ?? "Never"}</p>
          <p>Queued: {connectivityInputs.queuedCount === 0 ? "All caught up" : `${connectivityInputs.queuedCount} items`}</p>
          <p>Storage: {storageUsageLabel}</p>
          <button type="button" onClick={onRetryConnection}>
            Retry connection
          </button>
          <button type="button" onClick={onJumpToSyncStatus}>
            Sync Status
          </button>
          <button type="button" onClick={onManageStorage}>
            Manage storage
          </button>
        </div>
      )}
    </div>
  );
}
