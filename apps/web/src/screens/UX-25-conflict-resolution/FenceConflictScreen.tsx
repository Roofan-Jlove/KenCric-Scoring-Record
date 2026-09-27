import { useState } from "react";
import { resolveFenceConflict, type FenceConflictResolution } from "./fenceConflictForm";

/**
 * TASK-0085: `ux-specification.md UX-25` -- Conflict Resolution,
 * fence-conflict half only (the V2 dual-scorer-divergence half is
 * deferred, see this task's own backlog entry). Styling not applied,
 * same scope boundary as every earlier screen this session.
 */

export interface FenceConflictScreenProps {
  otherDeviceId: string;
  conflictDetectedAt: string;
  onResolved: (resolution: FenceConflictResolution) => void;
}

export function FenceConflictScreen({ otherDeviceId, conflictDetectedAt, onResolved }: FenceConflictScreenProps) {
  const [confirmingTakeOver, setConfirmingTakeOver] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    const result = resolveFenceConflict("DISCARD_LOCALLY", acknowledged);
    if (result.outcome === "resolved") onResolved(result.resolution);
  }

  function handleConfirmTakeOver() {
    const result = resolveFenceConflict("TAKE_OVER", acknowledged);
    if (result.outcome === "rejected") {
      setError(result.reason);
      return;
    }
    setError(null);
    onResolved(result.resolution);
  }

  return (
    <div>
      <p role="alert">
        Another device ({otherDeviceId}) is scoring this match, since {conflictDetectedAt}.
      </p>

      {!confirmingTakeOver ? (
        <div>
          <button type="button" onClick={() => setConfirmingTakeOver(true)}>
            Take over scoring on this device
          </button>
          <button type="button" onClick={handleCancel}>
            Cancel and keep the original device active
          </button>
        </div>
      ) : (
        <div>
          <label>
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
            I understand the other device will be locked out
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="button" onClick={handleConfirmTakeOver}>
            Confirm take over
          </button>
          <button type="button" onClick={() => setConfirmingTakeOver(false)}>
            Back
          </button>
        </div>
      )}
    </div>
  );
}
