import { useEffect, useState } from "react";
import { formatBowlerFigures, type OverSummary } from "./overCompletionSummary";

/**
 * TASK-0067: `ux-specification.md UX-16` -- Over Completion. Styling
 * not applied, same scope boundary as every earlier screen this
 * session.
 *
 * `autoAdvanceMs` (UX-16's own Actions text: "configurable auto-advance
 * after a short interval") is an optional caller-supplied duration --
 * the timer itself is a component-level side effect, not part of the
 * tested pure formatting module.
 */

export interface OverCompletionScreenProps {
  summary: OverSummary;
  ballsPerOver: number;
  autoAdvanceMs?: number;
  onAcknowledge: () => void;
  onJumpToCorrection: () => void;
}

export function OverCompletionScreen({
  summary,
  ballsPerOver,
  autoAdvanceMs,
  onAcknowledge,
  onJumpToCorrection,
}: OverCompletionScreenProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (autoAdvanceMs === undefined) return;
    const timer = setTimeout(onAcknowledge, autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [autoAdvanceMs, onAcknowledge]);

  return (
    <div>
      <p aria-label="Over summary">
        Over {summary.overNumber}: {summary.runsConceded} runs, {summary.wicketsThisOver} wickets
        {summary.isMaiden && <span> · Maiden</span>}
      </p>

      <button type="button" onClick={() => setExpanded((v) => !v)}>
        {expanded ? "Hide" : "Expand"} over detail
      </button>

      {expanded && <p aria-label="Bowler figures">{formatBowlerFigures(summary.bowlerFigures, ballsPerOver)}</p>}

      <button type="button" onClick={onAcknowledge}>
        Continue
      </button>
      <button type="button" onClick={onJumpToCorrection}>
        Jump to Score Correction
      </button>
    </div>
  );
}
