import { useState } from "react";
import { canConfirm, canPropose, describeDivergence, type DivergenceItem } from "./divergenceResolutionForm";

/**
 * `ux-specification.md UX-25` -- the dual-scorer-divergence half.
 * Propose/Confirm are the only two real transitions this screen
 * exposes, matching the real backend's own state machine exactly
 * (`divergenceResolution.ts`, `TASK-0125`: OPEN -> PROPOSED via
 * `proposeDivergenceResolution`, PROPOSED -> RESOLVED via
 * `confirmDivergenceResolution`). `UX-25`'s own Actions text also
 * lists "Reject and re-propose" and "View full context of the
 * disputed ball" -- NEITHER is built here: the real backend has no
 * reject/re-propose transition at all (once PROPOSED, the only real
 * state change is confirm), and no "full context" data exists beyond
 * this row's own two values. Flagged, not fabricated.
 */

export interface DivergenceResolutionScreenProps {
  items: readonly DivergenceItem[];
  currentStreamId: string | null;
  currentActorId: string | null;
  onPropose: (id: string, proposedValue: string) => void;
  onConfirm: (id: string) => void;
  isOffline: boolean;
}

export function DivergenceResolutionScreen({ items, currentStreamId, currentActorId, onPropose, onConfirm, isOffline }: DivergenceResolutionScreenProps) {
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [proposedValue, setProposedValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openOrProposed = items.filter((item) => item.status !== "RESOLVED");

  function handlePropose(item: DivergenceItem) {
    const result = canPropose(proposedValue);
    if (result.outcome === "blocked") {
      setError(result.reason);
      return;
    }
    setError(null);
    onPropose(item.id, proposedValue);
    setProposingId(null);
    setProposedValue("");
  }

  function handleConfirm(item: DivergenceItem) {
    const result = canConfirm(item, currentActorId);
    if (result.outcome === "blocked") {
      setError(result.reason);
      return;
    }
    setError(null);
    onConfirm(item.id);
  }

  if (openOrProposed.length === 0) {
    // UX-25's own Empty states text, verbatim.
    return <p role="status">No conflicts — logs match.</p>;
  }

  return (
    <div>
      <h2>Divergences</h2>
      {error && <p role="alert">{error}</p>}
      <ul aria-label="Divergent deliveries">
        {openOrProposed.map((item) => (
          <li key={item.id}>
            <p>{describeDivergence(item, currentStreamId)}</p>
            <p>Status: {item.status}</p>
            {item.status === "OPEN" && proposingId !== item.id && (
              <button type="button" onClick={() => { setProposingId(item.id); setProposedValue(""); setError(null); }}>
                Propose an agreed version
              </button>
            )}
            {proposingId === item.id && (
              <div>
                <label htmlFor={`proposed-${item.id}`}>Agreed value</label>
                <input id={`proposed-${item.id}`} value={proposedValue} onChange={(event) => setProposedValue(event.target.value)} disabled={isOffline} />
                <button type="button" onClick={() => handlePropose(item)} disabled={isOffline}>
                  Submit proposal
                </button>
                <button type="button" onClick={() => setProposingId(null)}>
                  Cancel
                </button>
              </div>
            )}
            {item.status === "PROPOSED" && (
              <div>
                <p>Proposed value: {String(item.proposedValue)}</p>
                <button
                  type="button"
                  onClick={() => handleConfirm(item)}
                  disabled={isOffline}
                  aria-label={`Confirm the proposed value for over-ball ${item.overBall}, ${item.field}`}
                >
                  Confirm
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
