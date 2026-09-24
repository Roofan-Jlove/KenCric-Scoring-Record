import { useState } from "react";
import { canConfirmCorrection, describeCascade, type CascadeSummary } from "./scoreCorrectionForm";

/**
 * TASK-0069: `ux-specification.md UX-17` -- Score Correction. Styling
 * not applied, same scope boundary as every earlier screen this
 * session.
 *
 * `cascadeSummary` is caller-supplied -- it's the already-computed
 * output of `shared/`'s `correctDelivery()`, not recomputed here. The
 * over/ball navigator and the field-level editor (Ball/Wicket/Extras,
 * pre-filled) are out of this task's scope -- flagged in this task's
 * own backlog entry as genuinely complex domain logic left to the
 * integration layer, not fabricated.
 */

export interface ScoreCorrectionScreenProps {
  cascadeSummary: CascadeSummary;
  isFinal: boolean;
  hasElevatedRole: boolean;
  onSave: (reason: string) => void;
  onCancel: () => void;
}

export function ScoreCorrectionScreen({ cascadeSummary, isFinal, hasElevatedRole, onSave, onCancel }: ScoreCorrectionScreenProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const result = canConfirmCorrection({ reason, isFinal, hasElevatedRole });
    if (result.outcome === "blocked") {
      setError(result.reason);
      return;
    }
    setError(null);
    onSave(reason.trim());
  }

  return (
    <div>
      {isFinal && (
        <p role="status">This match is Final. Corrections require an elevated role and will trigger re-sign-off.</p>
      )}

      <div aria-label="Cascade summary">
        <h2>What will change</h2>
        <ul>
          {describeCascade(cascadeSummary).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <label htmlFor="correction-reason">Reason for correction</label>
      <input id="correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} />

      {error && <p role="alert">{error}</p>}

      <button type="button" onClick={handleSave}>
        Save
      </button>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
