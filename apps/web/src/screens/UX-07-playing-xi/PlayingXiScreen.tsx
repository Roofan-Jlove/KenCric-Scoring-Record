import { useRef, useState } from "react";
import {
  addAdHocPlayer,
  canContinue,
  findDuplicatePlayerId,
  initialSideXiState,
  setCaptain,
  setKeeper,
  sideValidationIssues,
  togglePlayer,
  type Player,
  type PlayingXiState,
  type SideXiState,
} from "./playingXiForm";

/**
 * TASK-0049: `ux-specification.md UX-07` -- Playing XI. Styling not
 * applied, same scope boundary as every earlier screen this session.
 *
 * FLAGGED RESOLUTION OF A SPEC TENSION: `UX-07`'s own States text says
 * "Invalid... Continue disabled," but its Error-handling text says "a
 * Continue attempt with no keeper marked shows an inline error and moves
 * focus to the keeper picker" -- a native `disabled` button cannot be
 * clicked or receive a focus-moving "attempt" at all, so the two lines
 * can't both be satisfied by a literal `disabled` attribute. Resolved
 * here with the standard accessible pattern for this exact tension:
 * `aria-disabled` (communicates "disabled" to assistive tech) on a
 * button that stays natively clickable, whose click handler shows the
 * specific error and moves focus rather than silently no-opping.
 */

export interface PlayingXiScreenProps {
  squadA: readonly Player[];
  squadB: readonly Player[];
  requiredXiSize: number;
  onContinue: (state: PlayingXiState) => void;
}

let adHocCounter = 0;

type Side = "A" | "B";

export function PlayingXiScreen({ squadA, squadB, requiredXiSize, onContinue }: PlayingXiScreenProps) {
  const [state, setState] = useState<PlayingXiState>(() => ({
    sideA: initialSideXiState(squadA),
    sideB: initialSideXiState(squadB),
  }));
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState<{ A: string; B: string }>({ A: "", B: "" });
  const [continueAttempted, setContinueAttempted] = useState(false);
  const keeperRefs = { A: useRef<HTMLInputElement | null>(null), B: useRef<HTMLInputElement | null>(null) };

  function sideKey(side: Side): "sideA" | "sideB" {
    return side === "A" ? "sideA" : "sideB";
  }

  function handleToggle(side: Side, playerId: string) {
    const key = sideKey(side);
    const result = togglePlayer(state[key], playerId, requiredXiSize);
    if (result.outcome === "blocked") {
      setBlockedReason(result.reason);
      return;
    }
    setBlockedReason(null);
    setState((s) => ({ ...s, [key]: result.state }));
  }

  function handleSetCaptain(side: Side, playerId: string) {
    const key = sideKey(side);
    const result = setCaptain(state[key], playerId);
    if (result.outcome === "set") setState((s) => ({ ...s, [key]: result.state }));
  }

  function handleSetKeeper(side: Side, playerId: string) {
    const key = sideKey(side);
    const result = setKeeper(state[key], playerId);
    if (result.outcome === "set") setState((s) => ({ ...s, [key]: result.state }));
  }

  function handleAddAdHoc(side: Side) {
    const name = newPlayerName[side].trim();
    if (!name) return;
    adHocCounter += 1;
    const key = sideKey(side);
    const result = addAdHocPlayer(state[key], name, requiredXiSize, `adhoc-${adHocCounter}`);
    if (result.outcome === "blocked") {
      setBlockedReason(result.reason);
      return;
    }
    setBlockedReason(null);
    setState((s) => ({ ...s, [key]: result.state }));
    setNewPlayerName((n) => ({ ...n, [side]: "" }));
  }

  const duplicateId = findDuplicatePlayerId(state);
  const issuesA = sideValidationIssues(state.sideA, "A", requiredXiSize);
  const issuesB = sideValidationIssues(state.sideB, "B", requiredXiSize);
  const continueEnabled = canContinue(state, requiredXiSize);

  function handleContinueClick() {
    setContinueAttempted(true);
    if (!continueEnabled) {
      if (issuesA.some((i) => i.issue === "keeper")) {
        keeperRefs.A.current?.focus();
      } else if (issuesB.some((i) => i.issue === "keeper")) {
        keeperRefs.B.current?.focus();
      }
      return;
    }
    onContinue(state);
  }

  function renderSide(side: Side, sideState: SideXiState, issues: typeof issuesA) {
    return (
      <section aria-label={`Team ${side} XI`}>
        <h2>Team {side}</h2>
        <p aria-live="polite">
          {sideState.selectedIds.length} of {requiredXiSize} selected
        </p>

        <ul aria-label={`Team ${side} squad`}>
          {sideState.squad.map((p) => (
            <li key={p.id}>
              <label>
                <input
                  type="checkbox"
                  checked={sideState.selectedIds.includes(p.id)}
                  onChange={() => handleToggle(side, p.id)}
                />
                {p.name}
              </label>
            </li>
          ))}
        </ul>

        <fieldset>
          <legend>Captain</legend>
          {sideState.selectedIds.map((id) => {
            const player = sideState.squad.find((p) => p.id === id);
            if (!player) return null;
            return (
              <label key={id}>
                <input
                  type="radio"
                  name={`captain-${side}`}
                  checked={sideState.captainId === id}
                  onChange={() => handleSetCaptain(side, id)}
                />
                {player.name}
              </label>
            );
          })}
        </fieldset>

        <fieldset>
          <legend>Wicket-keeper</legend>
          {sideState.selectedIds.map((id, index) => {
            const player = sideState.squad.find((p) => p.id === id);
            if (!player) return null;
            return (
              <label key={id}>
                <input
                  ref={index === 0 ? keeperRefs[side] : undefined}
                  type="radio"
                  name={`keeper-${side}`}
                  checked={sideState.keeperId === id}
                  onChange={() => handleSetKeeper(side, id)}
                />
                {player.name}
              </label>
            );
          })}
        </fieldset>

        <label htmlFor={`add-adhoc-${side}`}>Add player by name</label>
        <input
          id={`add-adhoc-${side}`}
          value={newPlayerName[side]}
          onChange={(event) => setNewPlayerName((n) => ({ ...n, [side]: event.target.value }))}
        />
        <button type="button" onClick={() => handleAddAdHoc(side)}>
          Add
        </button>

        {continueAttempted && issues.length > 0 && (
          <ul role="alert" aria-label={`Team ${side} issues`}>
            {issues.map((issue) => (
              <li key={issue.issue}>{issue.message}</li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <form
      aria-label="Playing XI"
      onSubmit={(event) => {
        event.preventDefault();
        handleContinueClick();
      }}
    >
      {blockedReason && <p role="alert">{blockedReason}</p>}
      {continueAttempted && duplicateId !== null && <p role="alert">Player already selected on the other side</p>}

      {renderSide("A", state.sideA, issuesA)}
      {renderSide("B", state.sideB, issuesB)}

      <button type="submit" aria-disabled={!continueEnabled}>
        Continue
      </button>
    </form>
  );
}
