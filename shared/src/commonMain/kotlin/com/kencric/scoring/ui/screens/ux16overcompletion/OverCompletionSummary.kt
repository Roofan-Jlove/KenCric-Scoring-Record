package com.kencric.scoring.ui.screens.ux16overcompletion

/**
 * TASK-0068: `ux-specification.md UX-16`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-16-over-completion/
 * overCompletionSummary.ts` (`TASK-0067`) -- same contract-only scope
 * note as every earlier screen this session: no Android SDK/Gradle/
 * Kotlin toolchain exists, placed in `shared/commonMain` since this
 * logic touches no Android API surface at all.
 *
 * See `TASK-0067`'s own file for the citation notes: `FR-063` here is
 * discovery-level (a different namespace than `UX-10`'s own SRS-level
 * `FR-063` citation), and `CORR-008` is NOT implemented here -- it's
 * about end-of-innings/end-of-match reconciliation, `UX-17`'s territory.
 */

data class BowlerFigures(
    val legalBallsBowled: Int,
    val runsCharged: Int,
    val wickets: Int,
    val maidens: Int,
)

data class OverSummary(
    val overNumber: Int,
    val runsConceded: Int,
    val wicketsThisOver: Int,
    val isMaiden: Boolean,
    val bowlerFigures: BowlerFigures,
)

/** Same `O.B` display notation `TASK-0055`/`0065` already established, per `RUN-013`. */
fun formatOvers(legalBalls: Int, ballsPerOver: Int): String {
    val completedOvers = legalBalls / ballsPerOver
    val ballsIntoOver = legalBalls % ballsPerOver
    return "$completedOvers.$ballsIntoOver"
}

private fun plural(count: Int, noun: String): String = "$count $noun${if (count == 1) "" else "s"}"

/** UX-16's own Inputs: "the outgoing bowler's updated figures." */
fun formatBowlerFigures(figures: BowlerFigures, ballsPerOver: Int): String =
    "${formatOvers(figures.legalBallsBowled, ballsPerOver)} overs, ${plural(figures.maidens, "maiden")}, ${plural(figures.runsCharged, "run")}, ${plural(figures.wickets, "wicket")}"
