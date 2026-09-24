import { useState } from "react";
import { canSubmit, composeRunValue, deriveBallEntryState, requiresLightweightConfirm } from "./ballEntryForm";

/**
 * TASK-0057: `ux-specification.md UX-11` -- Ball Entry. Styling not
 * applied, same scope boundary as every earlier screen this session.
 *
 * "single tap = commit" for the primary 0-6 buttons -- these submit
 * immediately, no confirmation dialog (`UX-11`'s own Error-handling
 * text: "No confirmation dialog on normal runs"). The overthrow add-on
 * is a separate, optional second interaction, staying within `NFR-001`'s
 * ≤2-interaction budget.
 */

export interface BallEntryScreenProps {
  isFreeHit: boolean;
  isGuardrailModalOpen: boolean;
  justRecorded: boolean;
  undoAvailable: boolean;
  overthrowConfirmThreshold: number;
  onSubmit: (totalRuns: number, commentary: string | null) => void;
  onUndo: () => void;
}

export function BallEntryScreen({
  isFreeHit,
  isGuardrailModalOpen,
  justRecorded,
  undoAvailable,
  overthrowConfirmThreshold,
  onSubmit,
  onUndo,
}: BallEntryScreenProps) {
  const [overthrowExpanded, setOverthrowExpanded] = useState(false);
  const [primaryTap, setPrimaryTap] = useState<number | null>(null);
  const [overthrowValue, setOverthrowValue] = useState(0);
  const [commentary, setCommentary] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<{ totalRuns: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = deriveBallEntryState({ isGuardrailModalOpen, justRecorded, undoAvailable });
  const submittable = canSubmit(state);

  function commit(totalRuns: number) {
    onSubmit(totalRuns, commentary.trim() === "" ? null : commentary.trim());
    setCommentary("");
    setOverthrowExpanded(false);
    setPrimaryTap(null);
    setOverthrowValue(0);
    setPendingConfirm(null);
    setError(null);
  }

  function handleDirectTap(value: number) {
    if (!submittable) return;
    const result = composeRunValue(value, 0);
    if (result.outcome === "invalid") {
      setError(result.reason);
      return;
    }
    commit(result.totalRuns);
  }

  function handleOverthrowSubmit() {
    if (!submittable || primaryTap === null) return;
    const result = composeRunValue(primaryTap, overthrowValue);
    if (result.outcome === "invalid") {
      setError(result.reason);
      return;
    }
    setError(null);
    if (requiresLightweightConfirm(overthrowValue, overthrowConfirmThreshold)) {
      setPendingConfirm({ totalRuns: result.totalRuns });
      return;
    }
    commit(result.totalRuns);
  }

  return (
    <div>
      {isFreeHit && (
        <p role="status" aria-label="Free hit">
          Free hit
        </p>
      )}
      {state === "GUARDRAIL_BLOCKED" && <p role="alert">Blocked -- resolve the guardrail modal before recording a ball</p>}
      {error && <p role="alert">{error}</p>}

      <div role="group" aria-label="Run value">
        {[0, 1, 2, 3, 4, 5, 6].map((value) => (
          <button key={value} type="button" onClick={() => handleDirectTap(value)} disabled={!submittable}>
            {value}
          </button>
        ))}
      </div>

      <button type="button" onClick={() => setOverthrowExpanded((v) => !v)} disabled={!submittable}>
        Add overthrow
      </button>

      {overthrowExpanded && (
        <div role="group" aria-label="Overthrow entry">
          <label htmlFor="overthrow-primary">Run value</label>
          <select
            id="overthrow-primary"
            value={primaryTap ?? ""}
            onChange={(event) => setPrimaryTap(event.target.value === "" ? null : Number(event.target.value))}
          >
            <option value="">Select</option>
            {[0, 1, 2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <label htmlFor="overthrow-addon">Overthrow runs</label>
          <input
            id="overthrow-addon"
            type="number"
            value={overthrowValue}
            onChange={(event) => setOverthrowValue(Number(event.target.value))}
          />
          <button type="button" onClick={handleOverthrowSubmit} disabled={!submittable || primaryTap === null}>
            Confirm overthrow
          </button>
        </div>
      )}

      {pendingConfirm && (
        <div role="alertdialog" aria-label="Confirm large overthrow">
          <p>Confirm {pendingConfirm.totalRuns} runs including a large overthrow?</p>
          <button type="button" onClick={() => commit(pendingConfirm.totalRuns)}>
            Confirm
          </button>
          <button type="button" onClick={() => setPendingConfirm(null)}>
            Cancel
          </button>
        </div>
      )}

      <label htmlFor="commentary">Commentary note (optional)</label>
      <input id="commentary" value={commentary} onChange={(event) => setCommentary(event.target.value)} />

      <button type="button" onClick={onUndo} disabled={state !== "UNDO_AVAILABLE"}>
        Undo
      </button>
    </div>
  );
}
