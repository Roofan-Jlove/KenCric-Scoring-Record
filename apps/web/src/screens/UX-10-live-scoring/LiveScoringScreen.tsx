import {
  computeBallsRemaining,
  computeRequiredRunRate,
  computeRunRate,
  computeRunsRequired,
  deriveScoringState,
  formatOvers,
  isChasing,
  type ScoringStateInputs,
} from "./liveScoringDisplay";

/**
 * TASK-0055: `ux-specification.md UX-10` -- Live Scoring, display +
 * navigation hub. Styling not applied, same scope boundary as every
 * earlier screen this session.
 *
 * `lastBallAnnouncement` (for the "Dot ball. 45 for 2." live region) and
 * the extras breakdown are caller-supplied -- deriving natural-language
 * ball descriptions from raw delivery data is `UX-11`/`EventGenerator`'s
 * domain, not this hub screen's own derived-display scope. Action
 * buttons are always rendered, not availability-gated by screen state --
 * that gating logic doesn't exist anywhere in this corpus yet (see this
 * task's own backlog entry) and is left for a later, explicitly-scoped
 * task rather than fabricated here.
 */

export interface ExtrasBreakdown {
  byes: number;
  legByes: number;
  wides: number;
  noBalls: number;
  penalties: number;
}

export interface LiveScoringScreenProps {
  strikerName: string;
  nonStrikerName: string;
  bowlerName: string;
  runs: number;
  wickets: number;
  legalBallsBowled: number;
  totalBallsAllotted: number;
  ballsPerOver: number;
  extras: ExtrasBreakdown;
  target: number | null;
  inningsNumber: number;
  isOnline: boolean;
  lastBallAnnouncement: string;
  stateInputs: ScoringStateInputs;
  onScoreBall: () => void;
  onRecordWicket: () => void;
  onRecordExtra: () => void;
  onUndoLast: () => void;
  onPause: () => void;
  onOpenBallByBall: () => void;
  onOpenScorecard: () => void;
  onReviewStrike: () => void;
}

export function LiveScoringScreen({
  strikerName,
  nonStrikerName,
  bowlerName,
  runs,
  wickets,
  legalBallsBowled,
  totalBallsAllotted,
  ballsPerOver,
  extras,
  target,
  inningsNumber,
  isOnline,
  lastBallAnnouncement,
  stateInputs,
  onScoreBall,
  onRecordWicket,
  onRecordExtra,
  onUndoLast,
  onPause,
  onOpenBallByBall,
  onOpenScorecard,
  onReviewStrike,
}: LiveScoringScreenProps) {
  const runRate = computeRunRate(runs, legalBallsBowled, ballsPerOver);
  const runsRequired = computeRunsRequired(target, runs);
  const ballsRemaining = computeBallsRemaining(totalBallsAllotted, legalBallsBowled);
  const requiredRunRate = computeRequiredRunRate(runsRequired, ballsRemaining, ballsPerOver);
  const scoringState = deriveScoringState(stateInputs);
  const chasing = isChasing(inningsNumber, target);

  const extrasTotal = extras.byes + extras.legByes + extras.wides + extras.noBalls + extras.penalties;

  return (
    <div>
      <p role="status" aria-label="Connectivity">
        {isOnline ? "Online" : "Offline"}
      </p>

      <p aria-label="Score">
        {runs} for {wickets} ({formatOvers(legalBallsBowled, ballsPerOver)} overs)
      </p>
      <p aria-label="Batters">
        {strikerName}* / {nonStrikerName}
      </p>
      <p aria-label="Bowler">{bowlerName}</p>
      <p aria-label="Extras">Extras: {extrasTotal} (b {extras.byes}, lb {extras.legByes}, w {extras.wides}, nb {extras.noBalls}, pen {extras.penalties})</p>
      <p aria-label="Run rate">{runRate !== null ? runRate.toFixed(2) : "—"}</p>

      {chasing && (
        <p aria-label="Chase status">
          Need {runsRequired} off {ballsRemaining} balls ({requiredRunRate !== null ? requiredRunRate.toFixed(2) : "—"} RRR)
        </p>
      )}

      <p aria-live="polite">{lastBallAnnouncement}</p>

      <p aria-label="Scoring state">{scoringState}</p>

      <div>
        <button type="button" onClick={onScoreBall}>
          Score a ball
        </button>
        <button type="button" onClick={onRecordWicket}>
          Record a wicket
        </button>
        <button type="button" onClick={onRecordExtra}>
          Record an extra
        </button>
        <button type="button" onClick={onUndoLast}>
          Undo last
        </button>
        <button type="button" onClick={onPause}>
          Pause
        </button>
        <button type="button" onClick={onOpenBallByBall}>
          Open Ball-by-Ball
        </button>
        <button type="button" onClick={onOpenScorecard}>
          Open Scorecard
        </button>
        <button type="button" onClick={onReviewStrike}>
          Review/override strike
        </button>
      </div>
    </div>
  );
}
