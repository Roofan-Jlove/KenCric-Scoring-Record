/**
 * TASK-0075: `ux-specification.md UX-20` -- Scorecard, batting/bowling/
 * extras/total formatting layer.
 *
 * Mirrors `shared/src/commonMain/.../core/model/{BatterCardLine,
 * BowlerCardLine,InningsScoreState}.kt` field-for-field -- reused
 * figures, not recomputed. Deliberately scoped narrower than the full
 * `cricket-rules-reference.md SCRD-001…028` catalogue: `UX-20`'s own
 * Purpose names exactly six things (batting card, bowling card, extras,
 * fall of wickets, partnerships, result) -- this module builds only the
 * parts `shared/` already has data for (batting/bowling/extras/total).
 * Partnerships, fall-of-wickets, and the result statement have no
 * aggregation logic anywhere in `shared/` yet -- accepted as caller-
 * supplied, pre-computed data for this display layer, not fabricated.
 *
 * CITATION NOTE: `FR-112…116` are SRS-level and correctly match this
 * screen's own scope -- discovery's own same-numbered `FR-112…116`
 * (dispute-resolution/multi-scorer territory) are unrelated but never
 * cited here, so no namespace trap this time.
 */

export type BatterStatus = "NOT_OUT" | "OUT" | "RETIRED_NOT_OUT" | "RETIRED_OUT" | "ABSENT";

export interface BatterCardLine {
  playerId: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  status: BatterStatus;
}

export interface BowlerCardLine {
  playerId: string;
  legalBallsBowled: number;
  runsCharged: number;
  wickets: number;
  widesBowled: number;
  noBallsBowled: number;
  maidens: number;
}

export interface InningsScoreState {
  totalRuns: number;
  byes: number;
  legByes: number;
  wides: number;
  noBalls: number;
  penalty: number;
  wicketsLost: number;
  legalBallsBowled: number;
}

/** Same `O.B` display notation `TASK-0055`/`0065`/`0067` already established, per `RUN-013`. */
export function formatOvers(legalBalls: number, ballsPerOver: number): string {
  const completedOvers = Math.floor(legalBalls / ballsPerOver);
  const ballsIntoOver = legalBalls % ballsPerOver;
  return `${completedOvers}.${ballsIntoOver}`;
}

/** Strike rate is `null` (not `0`/a crash) at zero balls faced -- the same "undefined, not zero" discipline `TASK-0055` established for run rate. */
export function formatStrikeRate(runs: number, ballsFaced: number): number | null {
  if (ballsFaced === 0) return null;
  return (runs / ballsFaced) * 100;
}

/** Economy is `null` at zero legal balls bowled, for the same reason. */
export function formatEconomy(runsCharged: number, legalBallsBowled: number, ballsPerOver: number): number | null {
  if (legalBallsBowled === 0) return null;
  return runsCharged / (legalBallsBowled / ballsPerOver);
}

/** `B-J1`: a batter dismissed for a genuine 0-off-0 duck is distinct from a batter who never batted -- satisfied structurally by `BatterCardLine | null` (a real line exists vs. none at all), not a separate flag. */
export function hasBatted(line: BatterCardLine | null): boolean {
  return line !== null;
}

/** `SCRD-007`: "Extras  (b N, lb N, w N, nb N, pen N)  = TOTAL". */
export function formatExtrasLine(extras: Pick<InningsScoreState, "byes" | "legByes" | "wides" | "noBalls" | "penalty">): string {
  const total = extras.byes + extras.legByes + extras.wides + extras.noBalls + extras.penalty;
  return `Extras (b ${extras.byes}, lb ${extras.legByes}, w ${extras.wides}, nb ${extras.noBalls}, pen ${extras.penalty}) = ${total}`;
}

/** `SCRD-008`: "Total  (W wkts, O.B overs)  RRR run rate" -- minutes are not tracked anywhere in `shared/`, so that portion of the literal format is omitted, flagged not fabricated. */
export function formatTotalLine(state: InningsScoreState, ballsPerOver: number): string {
  const runRate = formatEconomy(state.totalRuns, state.legalBallsBowled, ballsPerOver);
  const runRateText = runRate !== null ? runRate.toFixed(2) : "—";
  return `Total (${state.wicketsLost} wkts, ${formatOvers(state.legalBallsBowled, ballsPerOver)} overs) ${runRateText} run rate`;
}

/** `N-J1`/`INV-001`: "total_runs = Σ batter_card_lines.runs + Σ extras" -- a display-layer confirmation, even though `InningsScoreState`'s own doc comment already notes this holds true by construction upstream. */
export function totalIdentityHolds(
  battingLines: readonly BatterCardLine[],
  state: Pick<InningsScoreState, "totalRuns" | "byes" | "legByes" | "wides" | "noBalls" | "penalty">,
): boolean {
  const batterRunsTotal = battingLines.reduce((sum, line) => sum + line.runs, 0);
  const extrasTotal = state.byes + state.legByes + state.wides + state.noBalls + state.penalty;
  return state.totalRuns === batterRunsTotal + extrasTotal;
}
