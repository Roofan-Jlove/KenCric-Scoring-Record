import { useState } from "react";
import {
  amendToss,
  attemptEdit,
  canConfirm,
  confirmToss,
  deriveInningsOrder,
  initialTossState,
  type TossDecision,
  type TossState,
  type TossWinner,
} from "./tossForm";

/**
 * TASK-0051: `ux-specification.md UX-08` -- Toss. Styling not applied,
 * same scope boundary as every earlier screen this session.
 *
 * `isLocked` is caller-supplied (no `match_events` visibility here, same
 * as `TASK-0045`'s `MatchSetupScreen`). Unlike `TASK-0045`, `UX-08`'s own
 * text describes the amendment path as part of THIS screen ("offers the
 * amendment path rather than a flat refusal," "Amendment-mode... rare,
 * post-freeze, elevated permission"), so a real reason-entry flow is
 * built here rather than a static locked message. Permission-gating
 * itself ("elevated permission") is out of scope -- this screen has no
 * visibility into the caller's role, authorization is enforced
 * server-side per this corpus's established `SEC-*` boundary.
 */

export interface TossScreenProps {
  teamAName: string;
  teamBName: string;
  isLocked: boolean;
  onConfirm: (state: TossState, order: ReturnType<typeof deriveInningsOrder>) => void;
  onAmend: (state: TossState, reason: string) => void;
}

export function TossScreen({ teamAName, teamBName, isLocked, onConfirm, onAmend }: TossScreenProps) {
  const [state, setState] = useState<TossState>(initialTossState);
  const [rejection, setRejection] = useState<string | null>(null);
  const [amendmentMode, setAmendmentMode] = useState(false);
  const [amendWinner, setAmendWinner] = useState<TossWinner | null>(null);
  const [amendDecision, setAmendDecision] = useState<TossDecision | null>(null);
  const [amendReason, setAmendReason] = useState("");

  const teamName = (side: TossWinner) => (side === "A" ? teamAName : teamBName);

  function handleSelectWinner(winner: TossWinner) {
    setRejection(null);
    setState((s) => ({ ...s, winner }));
  }

  function handleSelectDecision(decision: TossDecision) {
    setRejection(null);
    setState((s) => ({ ...s, decision }));
  }

  function handleConfirmClick() {
    const result = confirmToss(state);
    if (result.outcome === "rejected") {
      setRejection(result.reason);
      return;
    }
    setRejection(null);
    setState(result.state);
    onConfirm(result.state, deriveInningsOrder(result.state.winner as TossWinner, result.state.decision as TossDecision));
  }

  function handleAmendSubmit() {
    if (amendWinner === null || amendDecision === null) return;
    const result = amendToss(amendWinner, amendDecision, amendReason);
    if (result.outcome === "rejected") {
      setRejection(result.reason);
      return;
    }
    setRejection(null);
    setState(result.state);
    setAmendmentMode(false);
    onAmend(result.state, amendReason.trim());
  }

  if (attemptEdit(isLocked) === "requires-amendment" && !amendmentMode) {
    return (
      <div>
        <p role="status">
          This toss is locked -- the first ball has already been recorded. Use the amendment path to make changes.
        </p>
        <button type="button" onClick={() => setAmendmentMode(true)}>
          Request an amendment
        </button>
      </div>
    );
  }

  if (amendmentMode) {
    return (
      <form
        aria-label="Amend toss"
        onSubmit={(event) => {
          event.preventDefault();
          handleAmendSubmit();
        }}
      >
        {rejection && <p role="alert">{rejection}</p>}
        <fieldset>
          <legend>Toss won by</legend>
          {(["A", "B"] as const).map((side) => (
            <label key={side}>
              <input
                type="radio"
                name="amend-winner"
                checked={amendWinner === side}
                onChange={() => setAmendWinner(side)}
              />
              {teamName(side)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Elected to</legend>
          {(["BAT", "BOWL"] as const).map((decision) => (
            <label key={decision}>
              <input
                type="radio"
                name="amend-decision"
                checked={amendDecision === decision}
                onChange={() => setAmendDecision(decision)}
              />
              {decision === "BAT" ? "Bat" : "Bowl"}
            </label>
          ))}
        </fieldset>
        <label htmlFor="amend-reason">Reason for amendment</label>
        <textarea id="amend-reason" value={amendReason} onChange={(event) => setAmendReason(event.target.value)} />
        <button type="submit">Submit amendment</button>
      </form>
    );
  }

  return (
    <form
      aria-label="Toss"
      onSubmit={(event) => {
        event.preventDefault();
        handleConfirmClick();
      }}
    >
      {rejection && <p role="alert">{rejection}</p>}
      <fieldset>
        <legend>Toss won by</legend>
        {(["A", "B"] as const).map((side) => (
          <label key={side}>
            <input type="radio" name="winner" checked={state.winner === side} onChange={() => handleSelectWinner(side)} />
            {teamName(side)}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Elected to</legend>
        {(["BAT", "BOWL"] as const).map((decision) => (
          <label key={decision}>
            <input
              type="radio"
              name="decision"
              checked={state.decision === decision}
              onChange={() => handleSelectDecision(decision)}
            />
            {decision === "BAT" ? "Bat" : "Bowl"}
          </label>
        ))}
      </fieldset>
      <button type="submit" disabled={!canConfirm(state)} aria-describedby={!canConfirm(state) ? "confirm-disabled-reason" : undefined}>
        Confirm
      </button>
      {!canConfirm(state) && <span id="confirm-disabled-reason">Select both toss winner and decision to confirm</span>}
    </form>
  );
}
