/**
 * TASK-0067: `ux-specification.md UX-16` -- Over Completion, display-
 * formatting layer.
 *
 * `UX-16`'s own Validation says "Not applicable" and Error-handling says
 * "Display-only" -- deliberately small scope, a formatting layer over
 * already-existing `shared/` types (`OverState`, `BowlerCardLine`), not
 * a validation-heavy screen.
 *
 * CITATION NOTE: `UX-16`'s `FR-063` is discovery-level ("Provide an
 * end-of-over checkpoint summarising the over and current figures," an
 * exact match to this screen's own Purpose) -- a DIFFERENT namespace
 * than `TASK-0055`'s own `FR-063` citation for `UX-10` (SRS-level,
 * "Persistent live-state panel"). `CORR-008` is NOT implemented here --
 * its actual text is about end-of-innings/end-of-match reconciliation,
 * a different granularity/concern than this per-over summary; that's
 * `UX-17` Score Correction's own territory.
 */

export interface BowlerFigures {
  legalBallsBowled: number;
  runsCharged: number;
  wickets: number;
  maidens: number;
}

export interface OverSummary {
  overNumber: number;
  runsConceded: number;
  wicketsThisOver: number;
  isMaiden: boolean;
  bowlerFigures: BowlerFigures;
}

/** Same `O.B` display notation `TASK-0055`/`0065` already established, per `RUN-013`. */
export function formatOvers(legalBalls: number, ballsPerOver: number): string {
  const completedOvers = Math.floor(legalBalls / ballsPerOver);
  const ballsIntoOver = legalBalls % ballsPerOver;
  return `${completedOvers}.${ballsIntoOver}`;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** UX-16's own Inputs: "the outgoing bowler's updated figures." */
export function formatBowlerFigures(figures: BowlerFigures, ballsPerOver: number): string {
  return `${formatOvers(figures.legalBallsBowled, ballsPerOver)} overs, ${plural(figures.maidens, "maiden")}, ${plural(figures.runsCharged, "run")}, ${plural(figures.wickets, "wicket")}`;
}
