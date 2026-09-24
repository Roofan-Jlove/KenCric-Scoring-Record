import { useState } from "react";
import {
  canConfirm,
  confirmAndStart,
  initialInningsSetupState,
  selectBowler,
  selectNonStriker,
  selectStriker,
  swapEnds,
  type InningsSetupState,
  type Player,
} from "./inningsSetupForm";

/**
 * TASK-0053: `ux-specification.md UX-09` -- Innings Setup. Styling not
 * applied, same scope boundary as every earlier screen this session.
 *
 * "Reopened for a later innings/Super Over (pre-filled with the correct
 * next-batting side where determinable)" -- `UX-09`'s own States text --
 * is out of scope here: this screen has no visibility into match state
 * beyond its own props, the same caller-supplied boundary `isLocked`
 * used in `TASK-0044`/`0045`/`0051`. A caller that knows the next
 * batting side can pre-fill via `InningsSetupScreen`'s own initial
 * render props in a follow-on task; not fabricated here.
 */

export interface InningsSetupScreenProps {
  battingSideName: string;
  fieldingSideName: string;
  battingXi: readonly Player[];
  fieldingXi: readonly Player[];
  onStart: (state: InningsSetupState) => void;
}

export function InningsSetupScreen({
  battingSideName,
  fieldingSideName,
  battingXi,
  fieldingXi,
  onStart,
}: InningsSetupScreenProps) {
  const [state, setState] = useState<InningsSetupState>(initialInningsSetupState);
  const [rejection, setRejection] = useState<string | null>(null);

  function findPlayer(pool: readonly Player[], id: string): Player | undefined {
    return pool.find((p) => p.id === id);
  }

  function handleSelectStriker(playerId: string) {
    const result = selectStriker(state, playerId, battingXi, battingSideName);
    if (result.outcome === "rejected") {
      setRejection(result.reason);
      return;
    }
    setRejection(null);
    setState(result.state);
  }

  function handleSelectNonStriker(playerId: string) {
    const result = selectNonStriker(state, playerId, battingXi, battingSideName);
    if (result.outcome === "rejected") {
      setRejection(result.reason);
      return;
    }
    setRejection(null);
    setState(result.state);
  }

  function handleSelectBowler(playerId: string) {
    const result = selectBowler(state, playerId, fieldingXi, fieldingSideName);
    if (result.outcome === "rejected") {
      setRejection(result.reason);
      return;
    }
    setRejection(null);
    setState(result.state);
  }

  function handleConfirm() {
    const result = confirmAndStart(state);
    if (result.outcome === "rejected") {
      setRejection(result.reason);
      return;
    }
    setRejection(null);
    onStart(result.state);
  }

  const striker = state.strikerId ? findPlayer(battingXi, state.strikerId) : undefined;
  const nonStriker = state.nonStrikerId ? findPlayer(battingXi, state.nonStrikerId) : undefined;

  return (
    <form
      aria-label="Innings setup"
      onSubmit={(event) => {
        event.preventDefault();
        handleConfirm();
      }}
    >
      {rejection && <p role="alert">{rejection}</p>}

      <fieldset>
        <legend>Striker</legend>
        {battingXi.map((p) => (
          <label key={p.id}>
            <input type="radio" name="striker" checked={state.strikerId === p.id} onChange={() => handleSelectStriker(p.id)} />
            {p.name}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Non-striker</legend>
        {battingXi.map((p) => (
          <label key={p.id}>
            <input
              type="radio"
              name="non-striker"
              checked={state.nonStrikerId === p.id}
              onChange={() => handleSelectNonStriker(p.id)}
            />
            {p.name}
          </label>
        ))}
      </fieldset>

      <button type="button" aria-label="Swap striker and non-striker" onClick={() => setState((s) => swapEnds(s))}>
        Swap ends
      </button>

      {striker && nonStriker && (
        <p aria-live="polite">
          Striker: {striker.name} · Non-striker: {nonStriker.name}
        </p>
      )}

      <fieldset>
        <legend>Opening bowler</legend>
        {fieldingXi.map((p) => (
          <label key={p.id}>
            <input type="radio" name="bowler" checked={state.bowlerId === p.id} onChange={() => handleSelectBowler(p.id)} />
            {p.name}
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={!canConfirm(state)}
        aria-describedby={!canConfirm(state) ? "confirm-start-disabled-reason" : undefined}
      >
        Confirm &amp; Start
      </button>
      {!canConfirm(state) && (
        <span id="confirm-start-disabled-reason">Select striker, non-striker, and opening bowler to continue</span>
      )}
    </form>
  );
}
