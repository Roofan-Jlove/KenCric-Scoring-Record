import { useState } from "react";
import { confirmSelection, guardrailBlocksFor, guardrailMessage, type BowlerCandidate, type GuardrailRule } from "./bowlerChangeForm";

/**
 * TASK-0065: `ux-specification.md UX-15` -- Bowler Change. Styling not
 * applied, same scope boundary as every earlier screen this session.
 *
 * `formatOvers` is duplicated in miniature from `TASK-0055`'s own
 * `UX-10-live-scoring/liveScoringDisplay.ts` rather than imported
 * across screen folders -- a deliberate small duplication, consistent
 * with every screen this session keeping its own folder self-contained.
 */

function formatOvers(legalBalls: number, ballsPerOver: number): string {
  const completedOvers = Math.floor(legalBalls / ballsPerOver);
  const ballsIntoOver = legalBalls % ballsPerOver;
  return `${completedOvers}.${ballsIntoOver}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function accessibleLabel(candidate: BowlerCandidate, ballsPerOver: number): string {
  return `${candidate.name}, ${formatOvers(candidate.legalBallsBowled, ballsPerOver)} overs, ${plural(candidate.maidens, "maiden")}, ${plural(candidate.runsCharged, "run")}, ${plural(candidate.wickets, "wicket")}`;
}

export interface BowlerChangeScreenProps {
  candidates: readonly BowlerCandidate[];
  previousOverBowlerId: string | null;
  bowlerOverCap: number | null;
  ballsPerOver: number;
  isAuthorisedToOverride: boolean;
  onConfirm: (candidateId: string, overrideReason: string | null) => void;
}

export function BowlerChangeScreen({
  candidates,
  previousOverBowlerId,
  bowlerOverCap,
  ballsPerOver,
  isAuthorisedToOverride,
  onConfirm,
}: BowlerChangeScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;
  const selectedBlocks: GuardrailRule[] = selected
    ? guardrailBlocksFor(selected, previousOverBowlerId, bowlerOverCap, ballsPerOver)
    : [];

  function handleSelect(candidateId: string) {
    setSelectedId(candidateId);
    setOverrideReason("");
    setError(null);
  }

  function handleConfirm() {
    if (!selected) return;
    const result = confirmSelection(selected, selectedBlocks, overrideReason);
    if (result.outcome === "rejected") {
      setError(result.reason);
      return;
    }
    setError(null);
    onConfirm(result.candidateId, selectedBlocks.length > 0 ? overrideReason.trim() : null);
  }

  return (
    <div>
      <ul role="listbox" aria-label="Select next bowler">
        {candidates.map((candidate) => {
          const blocks = guardrailBlocksFor(candidate, previousOverBowlerId, bowlerOverCap, ballsPerOver);
          const blocked = blocks.length > 0;
          return (
            <li key={candidate.id}>
              <button
                type="button"
                role="option"
                aria-selected={selectedId === candidate.id}
                aria-label={accessibleLabel(candidate, ballsPerOver)}
                aria-disabled={blocked && !isAuthorisedToOverride}
                disabled={blocked && !isAuthorisedToOverride}
                onClick={() => handleSelect(candidate.id)}
              >
                {candidate.name}
              </button>
              {blocked && <span>{blocks.map(guardrailMessage).join("; ")}</span>}
            </li>
          );
        })}
      </ul>

      {selected && selectedBlocks.length > 0 && (
        <div>
          <p role="alert">{selectedBlocks.map(guardrailMessage).join("; ")}</p>
          <label htmlFor="override-reason">Override reason</label>
          <input id="override-reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} />
        </div>
      )}

      {error && <p role="alert">{error}</p>}

      <button type="button" onClick={handleConfirm} disabled={!selected}>
        Confirm
      </button>
    </div>
  );
}
