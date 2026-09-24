package com.kencric.scoring.ui.screens.ux10livescoring

/**
 * TASK-0056: `ux-specification.md UX-10`'s own derived-display logic,
 * ported field-for-field from `apps/web/src/screens/UX-10-live-scoring/
 * liveScoringDisplay.ts` (`TASK-0055`) -- same contract-only scope note
 * as `TASK-0041`/`0046`/`0048`/`0050`/`0052`/`0054`: no Android SDK/
 * Gradle/Kotlin toolchain exists in this session, placed in
 * `shared/commonMain` since this logic touches no Android API surface
 * at all.
 *
 * See `TASK-0055`'s own file for the full scope note (deliberately no
 * action-availability matrix -- unspecified in this corpus) and the
 * citation note (`FR-063/065`'s discovery/SRS numbering collision).
 */

/**
 * `RUN-013`: "Run rate = runs ÷ overs (overs as decimal of legal
 * balls)." The true decimal (legal balls ÷ balls-per-over), NOT the
 * `O.B` display notation misread as a decimal.
 */
fun oversAsDecimal(legalBalls: Int, ballsPerOver: Int): Double = legalBalls.toDouble() / ballsPerOver

/** The `O.B` display notation cricket scorers actually read. */
fun formatOvers(legalBalls: Int, ballsPerOver: Int): String {
    val completedOvers = legalBalls / ballsPerOver
    val ballsIntoOver = legalBalls % ballsPerOver
    return "$completedOvers.$ballsIntoOver"
}

/** `RUN-013`: "Run rate = runs ÷ overs." `null` at zero balls bowled -- the rate is undefined, not zero. */
fun computeRunRate(runs: Int, legalBalls: Int, ballsPerOver: Int): Double? {
    if (legalBalls == 0) return null
    return runs / oversAsDecimal(legalBalls, ballsPerOver)
}

/** `TGT-005`: "runs required" -- `null` in the first innings (no target set yet). */
fun computeRunsRequired(target: Int?, currentRuns: Int): Int? {
    if (target == null) return null
    return maxOf(target - currentRuns, 0)
}

/** `TGT-005`: "balls remaining." */
fun computeBallsRemaining(totalBallsAllotted: Int, legalBallsBowled: Int): Int =
    maxOf(totalBallsAllotted - legalBallsBowled, 0)

/**
 * `RUN-013`: "Required run rate = runs still required ÷ overs
 * remaining." `null` with no target, or with zero balls remaining.
 */
fun computeRequiredRunRate(runsRequired: Int?, legalBallsRemaining: Int, ballsPerOver: Int): Double? {
    if (runsRequired == null) return null
    if (legalBallsRemaining == 0) return null
    return runsRequired / oversAsDecimal(legalBallsRemaining, ballsPerOver)
}

enum class ScoringState {
    PRE_FIRST_BALL,
    ACTIVE,
    BETWEEN_OVERS,
    INNINGS_BREAK,
    PAUSED,
    RECONCILIATION_BLOCKED,
    COMPLETE,
}

data class ScoringStateInputs(
    val legalBallsBowled: Int,
    val isBetweenOvers: Boolean,
    val isInningsBreak: Boolean,
    val isPaused: Boolean,
    val isReconciliationBlocked: Boolean,
    val isComplete: Boolean,
)

/**
 * Precedence -- complete > reconciliation-blocked > paused > innings-
 * break > between-overs > pre-first-ball > active -- is this task's own
 * explicit, flagged interpretation, not verbatim spec text (see
 * `TASK-0055`'s own file).
 */
fun deriveScoringState(inputs: ScoringStateInputs): ScoringState {
    if (inputs.isComplete) return ScoringState.COMPLETE
    if (inputs.isReconciliationBlocked) return ScoringState.RECONCILIATION_BLOCKED
    if (inputs.isPaused) return ScoringState.PAUSED
    if (inputs.isInningsBreak) return ScoringState.INNINGS_BREAK
    if (inputs.isBetweenOvers) return ScoringState.BETWEEN_OVERS
    if (inputs.legalBallsBowled == 0) return ScoringState.PRE_FIRST_BALL
    return ScoringState.ACTIVE
}

/** "Chasing (target visible)" modelled as a flag alongside `ScoringState`, since it coexists with Active/Between-overs/Paused during the second innings. */
fun isChasing(inningsNumber: Int, target: Int?): Boolean = inningsNumber >= 2 && target != null
