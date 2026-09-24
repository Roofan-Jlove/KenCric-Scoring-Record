import { useState } from "react";
import {
  applyGuardrailOverlay,
  attemptUndo,
  canRedo,
  canUndo,
  deriveBaseState,
  performRedo,
  performUndo,
  type UndoRedoState,
} from "./undoRedoState";

/**
 * TASK-0071: `ux-specification.md UX-18` -- Undo. Styling not applied,
 * same scope boundary as every earlier screen this session.
 *
 * `mostRecentActionLabel` (a human-readable description, e.g. "4 runs,
 * over 3.2") and `canFullyReverse` are caller-supplied -- this screen
 * has no visibility into a delivery's own internal structure.
 */

export interface UndoRedoControlProps {
  hasRecentAction: boolean;
  isGuardrailModalOpen: boolean;
  canFullyReverse: boolean;
  mostRecentActionLabel: string;
  onUndoApplied: (label: string) => void;
  onRedoApplied: (label: string) => void;
  onRouteToCorrection: (reason: string) => void;
}

export function UndoRedoControl({
  hasRecentAction,
  isGuardrailModalOpen,
  canFullyReverse,
  mostRecentActionLabel,
  onUndoApplied,
  onRedoApplied,
  onRouteToCorrection,
}: UndoRedoControlProps) {
  const [state, setState] = useState<UndoRedoState<string>>(() => deriveBaseState(hasRecentAction));
  const [announcement, setAnnouncement] = useState("");

  const displayState = applyGuardrailOverlay(state, isGuardrailModalOpen);

  function handleUndo() {
    const attempt = attemptUndo(canFullyReverse);
    if (attempt.outcome === "route-to-correction") {
      onRouteToCorrection(attempt.reason);
      return;
    }
    const nextState = performUndo(state, mostRecentActionLabel);
    setState(nextState);
    setAnnouncement(`Undone: ${mostRecentActionLabel}`);
    onUndoApplied(mostRecentActionLabel);
  }

  function handleRedo() {
    const result = performRedo(state);
    if (result.outcome === "unavailable") return;
    setState(result.nextState);
    setAnnouncement(`Redone: ${result.payload}`);
    onRedoApplied(result.payload);
  }

  return (
    <div>
      <button type="button" aria-label="Undo: revert last ball" onClick={handleUndo} disabled={!canUndo(displayState)}>
        Undo
      </button>
      {!canUndo(displayState) && (
        <span>
          {displayState.status === "GUARDRAIL_DISABLED" ? "Disabled while a guardrail modal is open" : "Nothing to undo"}
        </span>
      )}

      <button type="button" onClick={handleRedo} disabled={!canRedo(displayState)}>
        Redo
      </button>

      <p aria-live="polite">{announcement}</p>
    </div>
  );
}
