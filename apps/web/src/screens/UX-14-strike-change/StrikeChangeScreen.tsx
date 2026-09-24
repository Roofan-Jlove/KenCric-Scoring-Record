import { useState } from "react";
import { cancelSwap, confirmOverride, initialStrikeChangeFormState, toggleSwap, type StrikePositions } from "./strikeChangeForm";

/**
 * TASK-0063: `ux-specification.md UX-14` -- Strike Change. Styling not
 * applied, same scope boundary as every earlier screen this session.
 *
 * `readOnly` (the "brief over-transition animation" state) is caller-
 * supplied -- this pure logic layer has no notion of animation timing.
 */

export interface Player {
  id: string;
  name: string;
}

export interface StrikeChangeScreenProps {
  striker: Player;
  nonStriker: Player;
  readOnly: boolean;
  onOverrideConfirmed: (positions: StrikePositions, reason: string) => void;
}

export function StrikeChangeScreen({ striker, nonStriker, readOnly, onOverrideConfirmed }: StrikeChangeScreenProps) {
  const [state, setState] = useState(() =>
    initialStrikeChangeFormState({ strikerId: striker.id, nonStrikerId: nonStriker.id }),
  );
  const [reasonInput, setReasonInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const strikerPlayer = state.positions.strikerId === striker.id ? striker : nonStriker;
  const nonStrikerPlayer = state.positions.strikerId === striker.id ? nonStriker : striker;

  function handleSwapTap() {
    if (readOnly) return;
    setState((s) => toggleSwap(s));
    setError(null);
  }

  function handleCancel() {
    setState((s) => cancelSwap(s));
    setReasonInput("");
    setError(null);
  }

  function handleConfirm() {
    const result = confirmOverride(state, reasonInput);
    if (result.outcome === "rejected") {
      setError(result.reason);
      return;
    }
    setError(null);
    setState(result.state);
    setReasonInput("");
    onOverrideConfirmed(result.state.positions, result.state.reason);
  }

  return (
    <div aria-disabled={readOnly}>
      <p aria-label="Striker">
        <span aria-hidden="true">●</span> On strike: {strikerPlayer.name}
      </p>
      <p aria-label="Non-striker">Non-striker: {nonStrikerPlayer.name}</p>

      {state.status === "OVERRIDDEN" && <p role="status">Manually set</p>}

      {state.status !== "PENDING_OVERRIDE" && (
        <button type="button" aria-label="Swap striker and non-striker" onClick={handleSwapTap} disabled={readOnly}>
          Swap ends
        </button>
      )}

      {state.status === "PENDING_OVERRIDE" && (
        <div>
          <label htmlFor="override-reason">Reason for override</label>
          <input id="override-reason" value={reasonInput} onChange={(event) => setReasonInput(event.target.value)} />
          {error && <p role="alert">{error}</p>}
          <button type="button" onClick={handleConfirm}>
            Confirm override
          </button>
          <button type="button" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
