/**
 * TASK-0055: `ux-specification.md UX-10` -- Live Scoring, derived-display
 * layer only.
 *
 * SCOPE NOTE: `UX-10`'s own Validation line says "Not applicable directly
 * (display + navigation)" and there is no per-state action-availability
 * matrix written anywhere in this corpus. Building one here would
 * fabricate unspecified product design, so this module implements only
 * what IS concretely specified: the derived-display computations
 * `cricket-rules-reference.md RUN-013`/`TGT-005` define precisely, plus
 * a flagged, explicitly-interpretive state-derivation helper. The actual
 * ball-recording interactions (`UX-11`-`13`), the bowler-change/over-
 * completion prompts (`UX-14`-`16`), and DLS par (out of scope backlog-
 * wide per `§6.3`/`SPK-01`) are separate, later tasks.
 *
 * CITATION NOTE: `UX-10`'s Trace cites `FR-063/065` -- this is SRS
 * `FR-063` ("Persistent live-state panel") doubled with discovery's own
 * `FR-065` ("Display persistent live state...") for the SAME
 * requirement, not SRS's own separate `FR-065` ("Wicket-keeper change,"
 * unrelated) or discovery's own separate `FR-063` ("end-of-over
 * checkpoint," a different, `UX-16`-adjacent requirement).
 */

/**
 * `RUN-013`: "Run rate = runs ÷ overs (overs as decimal of legal balls)."
 * The critical, easy-to-get-wrong distinction: this is the TRUE decimal
 * (legal balls ÷ balls-per-over), NOT the `O.B` display notation
 * misread as a decimal (e.g. 12 overs 3 balls is decimal 12.5 overs,
 * not 12.3).
 */
export function oversAsDecimal(legalBalls: number, ballsPerOver: number): number {
  return legalBalls / ballsPerOver;
}

/** The `O.B` display notation cricket scorers actually read (completed overs, balls into the current over). */
export function formatOvers(legalBalls: number, ballsPerOver: number): string {
  const completedOvers = Math.floor(legalBalls / ballsPerOver);
  const ballsIntoOver = legalBalls % ballsPerOver;
  return `${completedOvers}.${ballsIntoOver}`;
}

/** `RUN-013`: "Run rate = runs ÷ overs." `null` (not a divide-by-zero crash) at zero balls bowled -- the rate is undefined, not zero. */
export function computeRunRate(runs: number, legalBalls: number, ballsPerOver: number): number | null {
  if (legalBalls === 0) return null;
  return runs / oversAsDecimal(legalBalls, ballsPerOver);
}

/** `TGT-005`: "runs required" -- `null` in the first innings (no target set yet). */
export function computeRunsRequired(target: number | null, currentRuns: number): number | null {
  if (target === null) return null;
  return Math.max(target - currentRuns, 0);
}

/** `TGT-005`: "balls remaining." */
export function computeBallsRemaining(totalBallsAllotted: number, legalBallsBowled: number): number {
  return Math.max(totalBallsAllotted - legalBallsBowled, 0);
}

/**
 * `RUN-013`: "Required run rate = runs still required ÷ overs
 * remaining." `null` when there's no target, or when there are no balls
 * left to bowl (the rate is undefined, not zero or infinite).
 */
export function computeRequiredRunRate(
  runsRequired: number | null,
  legalBallsRemaining: number,
  ballsPerOver: number,
): number | null {
  if (runsRequired === null) return null;
  if (legalBallsRemaining === 0) return null;
  return runsRequired / oversAsDecimal(legalBallsRemaining, ballsPerOver);
}

export type ScoringState =
  | "PRE_FIRST_BALL"
  | "ACTIVE"
  | "BETWEEN_OVERS"
  | "INNINGS_BREAK"
  | "PAUSED"
  | "RECONCILIATION_BLOCKED"
  | "COMPLETE";

export interface ScoringStateInputs {
  legalBallsBowled: number;
  isBetweenOvers: boolean;
  isInningsBreak: boolean;
  isPaused: boolean;
  isReconciliationBlocked: boolean;
  isComplete: boolean;
}

/**
 * `UX-10`'s own States list ("Pre-first-ball · Active scoring ·
 * Between-overs · Innings break · Paused · Chasing · Reconciliation-
 * blocked · Complete") describes these as parallel possibilities without
 * stating a precedence when more than one condition could hold at once
 * (e.g. paused AND reconciliation-blocked). The ordering below --
 * complete > reconciliation-blocked > paused > innings-break > between-
 * overs > pre-first-ball > active -- is this task's own explicit,
 * flagged interpretation, not verbatim spec text.
 */
export function deriveScoringState(inputs: ScoringStateInputs): ScoringState {
  if (inputs.isComplete) return "COMPLETE";
  if (inputs.isReconciliationBlocked) return "RECONCILIATION_BLOCKED";
  if (inputs.isPaused) return "PAUSED";
  if (inputs.isInningsBreak) return "INNINGS_BREAK";
  if (inputs.isBetweenOvers) return "BETWEEN_OVERS";
  if (inputs.legalBallsBowled === 0) return "PRE_FIRST_BALL";
  return "ACTIVE";
}

/** "Chasing (target visible)" is modelled as a flag alongside `ScoringState` rather than a mutually exclusive state, since it coexists with Active/Between-overs/Paused during the second innings. */
export function isChasing(inningsNumber: number, target: number | null): boolean {
  return inningsNumber >= 2 && target !== null;
}
