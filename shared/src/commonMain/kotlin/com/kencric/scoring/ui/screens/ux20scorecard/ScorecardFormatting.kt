package com.kencric.scoring.ui.screens.ux20scorecard

import com.kencric.scoring.core.model.BatterCardLine
import com.kencric.scoring.core.model.InningsScoreState

/**
 * TASK-0076: `ux-specification.md UX-20`'s own logic. Genuinely imports
 * the real `core.model.{BatterCardLine, InningsScoreState}` directly --
 * Kotlin-to-Kotlin reuse across the same `shared/commonMain` source
 * set, the same pattern `TASK-0060`/`0070` established -- rather than
 * re-mirroring them the way the web TS version (`TASK-0075`)
 * necessarily does. `BowlerCardLine`'s own fields (`legalBallsBowled`,
 * `runsCharged`) are consumed here as plain `Int`s via `formatEconomy`,
 * so no import of that type is needed in this file.
 *
 * See `TASK-0075`'s own file for the full scope note (deliberately
 * narrower than the full `SCRD-001…028` catalogue) and citation note
 * (`FR-112…116` clean, SRS-level, no namespace collision).
 */

/** Same `O.B` display notation `TASK-0055`/`0065`/`0067` already established, per `RUN-013`. */
fun formatOvers(legalBalls: Int, ballsPerOver: Int): String {
    val completedOvers = legalBalls / ballsPerOver
    val ballsIntoOver = legalBalls % ballsPerOver
    return "$completedOvers.$ballsIntoOver"
}

/** Strike rate is `null` at zero balls faced -- the same "undefined, not zero" discipline `TASK-0055` established. */
fun formatStrikeRate(runs: Int, ballsFaced: Int): Double? {
    if (ballsFaced == 0) return null
    return (runs.toDouble() / ballsFaced) * 100
}

/** Economy is `null` at zero legal balls bowled, for the same reason. */
fun formatEconomy(runsCharged: Int, legalBallsBowled: Int, ballsPerOver: Int): Double? {
    if (legalBallsBowled == 0) return null
    return runsCharged / (legalBallsBowled.toDouble() / ballsPerOver)
}

/** `B-J1`: a batter dismissed for a genuine 0-off-0 duck is distinct from a batter who never batted -- satisfied structurally by `BatterCardLine?` (a real line exists vs. none at all). */
fun hasBatted(line: BatterCardLine?): Boolean = line != null

/** `SCRD-007`: "Extras  (b N, lb N, w N, nb N, pen N)  = TOTAL". */
fun formatExtrasLine(state: InningsScoreState): String {
    val total = state.byes + state.legByes + state.wides + state.noBalls + state.penalty
    return "Extras (b ${state.byes}, lb ${state.legByes}, w ${state.wides}, nb ${state.noBalls}, pen ${state.penalty}) = $total"
}

/** `SCRD-008`: "Total  (W wkts, O.B overs)  RRR run rate" -- minutes are not tracked anywhere in `shared/`, so that portion of the literal format is omitted, flagged not fabricated. */
fun formatTotalLine(state: InningsScoreState, ballsPerOver: Int): String {
    val runRate = formatEconomy(state.totalRuns, state.legalBallsBowled, ballsPerOver)
    val runRateText = if (runRate != null) "%.2f".format(runRate) else "—"
    return "Total (${state.wicketsLost} wkts, ${formatOvers(state.legalBallsBowled, ballsPerOver)} overs) $runRateText run rate"
}

/** `N-J1`/`INV-001`: "total_runs = Σ batter_card_lines.runs + Σ extras." */
fun totalIdentityHolds(battingLines: List<BatterCardLine>, state: InningsScoreState): Boolean {
    val batterRunsTotal = battingLines.sumOf { it.runs }
    val extrasTotal = state.byes + state.legByes + state.wides + state.noBalls + state.penalty
    return state.totalRuns == batterRunsTotal + extrasTotal
}
