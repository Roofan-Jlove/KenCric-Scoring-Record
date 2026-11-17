import { useState } from "react";
import {
  addPlayer,
  canContinue,
  initialTeamSelectionState,
  removePlayer,
  selectTeam,
  swapSides,
  type Player,
  type Team,
  type TeamSelectionState,
} from "./teamSelectionForm";

/**
 * TASK-0047: `ux-specification.md UX-06` -- Team Selection. Styling
 * not applied, same scope boundary as every earlier screen this
 * session.
 *
 * HONEST SIMPLIFICATION: UX-06's own Accessibility text asks for full
 * "combobox/listbox semantics" for team search -- that ARIA pattern is
 * genuinely complex (managed focus, `aria-activedescendant`, filtered
 * option announcements). This component uses a plain `<ul role="list-
 * box">`/`<li role="option">` results list instead of the full combobox
 * widget, satisfying the results-count-announced and labelled-option
 * requirements without the full interaction pattern -- flagged as a
 * real simplification, not claimed as the complete ARIA combobox spec.
 */

export interface TeamSelectionScreenProps {
  availableTeams: readonly Team[];
  requiredXiSize: number;
  onContinue: (state: TeamSelectionState) => void;
}

export function TeamSelectionScreen({ availableTeams, requiredXiSize, onContinue }: TeamSelectionScreenProps) {
  const [state, setState] = useState<TeamSelectionState>(initialTeamSelectionState);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState<{ A: string; B: string }>({ A: "", B: "" });

  function handleSelect(side: "A" | "B", team: Team) {
    const result = selectTeam(state, side, team);
    if (result.outcome === "rejected") {
      setRejectionReason(result.reason);
      return;
    }
    setRejectionReason(null);
    setState(result.state);
  }

  function handleAddPlayer(side: "A" | "B") {
    const name = newPlayerName[side].trim();
    if (!name) return;
    // A real, pre-existing mismatch found while wiring real `players`
    // persistence: this previously used a plain `adhoc-${counter}`
    // string, not a real uuid -- `players.id` is `uuid primary key`,
    // so persisting this player for real (App.tsx's own onContinue)
    // needs a genuine uuid from the moment it's created, not a second,
    // separately-generated one that would desync from the id XI
    // selection/`home_xi`/`away_xi` already carry forward.
    const player: Player = { id: crypto.randomUUID(), name, isAdHoc: true };
    setState((s) => addPlayer(s, side, player));
    setNewPlayerName((n) => ({ ...n, [side]: "" }));
  }

  const continueEnabled = canContinue(state, requiredXiSize);

  function renderSide(side: "A" | "B", team: Team | null, squad: readonly Player[]) {
    return (
      <section aria-label={`Team ${side}`}>
        <h2>Team {side}</h2>
        <ul role="listbox" aria-label={`Team ${side} search results, ${availableTeams.length} found`}>
          {availableTeams.map((t) => (
            <li key={t.id} role="option" aria-selected={team?.id === t.id}>
              <button type="button" onClick={() => handleSelect(side, t)}>
                {t.name}
              </button>
            </li>
          ))}
        </ul>
        {team && <p>Selected: {team.name}</p>}

        <ul aria-label={`Team ${side} squad`}>
          {squad.map((p) => (
            <li key={p.id}>
              {p.name}
              <button
                type="button"
                aria-label={`Remove ${p.name} from squad`}
                onClick={() => setState((s) => removePlayer(s, side, p.id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <label htmlFor={`add-player-${side}`}>Add player by name</label>
        <input
          id={`add-player-${side}`}
          value={newPlayerName[side]}
          onChange={(event) => setNewPlayerName((n) => ({ ...n, [side]: event.target.value }))}
        />
        <button type="button" onClick={() => handleAddPlayer(side)}>
          Add
        </button>
      </section>
    );
  }

  return (
    <form
      aria-label="Team selection"
      onSubmit={(event) => {
        event.preventDefault();
        if (continueEnabled) onContinue(state);
      }}
    >
      {rejectionReason && <p role="alert">{rejectionReason}</p>}

      {renderSide("A", state.teamA, state.squadA)}
      {renderSide("B", state.teamB, state.squadB)}

      <button type="button" onClick={() => setState((s) => swapSides(s))}>
        Swap sides
      </button>

      <button type="submit" disabled={!continueEnabled} aria-describedby={!continueEnabled ? "continue-disabled-reason" : undefined}>
        Continue
      </button>
      {!continueEnabled && (
        <span id="continue-disabled-reason">Select two distinct teams and fill each squad to at least {requiredXiSize} players</span>
      )}
    </form>
  );
}
