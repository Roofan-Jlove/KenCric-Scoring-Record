package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.config.PlayingConditionsProfile
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.InningsScoreState
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.OverState
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventOrigin

/**
 * live-scoring.md §12 (Step 8), team/innings score update.
 *
 * RESOLVED AMBIGUITY: §12's `totalRuns` row reads "+= total (§7.2) + any
 * PENALTY RunEvent awarded to the batting side. Runs from a PENALTY
 * awarded to the fielding side do not touch this field" -- read
 * literally alongside a naive `total`, the first clause double-counts a
 * batting-side PENALTY (it's already inside `total`, §7.2's own formula
 * makes no side distinction). Resolved by treating the operative
 * instruction as the third sentence: `total` must have any
 * FIELDING-side-awarded PENALTY value subtracted back out before being
 * added to `totalRuns`. `extras.penalty`, by contrast, is left
 * unconditional (§12's own text doesn't side-qualify that row) -- it
 * records that a penalty event occurred at all, not who it credited.
 *
 * HONEST GAP: a PENALTY awarded to the fielding side is correctly
 * excluded from `totalRuns` here, but §7.7 says it must be credited "to
 * that other team's running total directly" -- crediting the *other*
 * team's ledger needs a structure spanning both sides' innings that
 * doesn't exist anywhere in this backlog yet. Excluded, not silently
 * dropped as if it never happened -- flagged for a future task.
 */
fun updateInningsScoreState(
    current: InningsScoreState,
    runEvents: List<RunEvent>,
    runAggregate: RunAggregate,
    bowlingTeamId: String,
    consumesLegalBallSlot: Boolean,
    dismissalMode: DismissalMode?,
): InningsScoreState {
    val penaltyToFieldingSide = runEvents
        .filter { it.origin == RunEventOrigin.PENALTY && it.awardedToTeamId == bowlingTeamId }
        .sumOf { it.value }
    val battingSideTotal = runAggregate.total - penaltyToFieldingSide

    // All 10 DismissalMode values are real dismissals (TASK-0017's own
    // scope note) -- §12's "except RETIRED_NOT_OUT" exception is already
    // structurally unreachable here: RETIRED_NOT_OUT was modeled only as
    // a BatterStatus (§9.8), never a DismissalMode, so a non-null
    // DismissalMode always counts as a wicket without further filtering.
    val countsAsWicket = dismissalMode != null

    return current.copy(
        totalRuns = current.totalRuns + battingSideTotal,
        byes = current.byes + (runAggregate.extras[ExtrasCategory.BYES] ?: 0),
        legByes = current.legByes + (runAggregate.extras[ExtrasCategory.LEG_BYES] ?: 0),
        wides = current.wides + (runAggregate.extras[ExtrasCategory.WIDES] ?: 0),
        noBalls = current.noBalls + (runAggregate.extras[ExtrasCategory.NO_BALLS] ?: 0),
        penalty = current.penalty + (runAggregate.extras[ExtrasCategory.PENALTY] ?: 0),
        wicketsLost = current.wicketsLost + if (countsAsWicket) 1 else 0,
        legalBallsBowled = current.legalBallsBowled + if (consumesLegalBallSlot) 1 else 0,
    )
}

/**
 * live-scoring.md §13.1-§13.3 (Step 9), one delivery's over-state update.
 * `ballsPerOver` comes from the match's pinned `PlayingConditionsProfile`
 * (`TASK-0008`'s freeze semantics), never hardcoded to 6 -- this is this
 * task's one stated Expected Behavior (`FA-6`).
 *
 * HONEST SCOPE NOTE: does not construct the *next* over's fresh
 * `OverState` -- see `OverState`'s own doc comment on why
 * `previousOverBowlerId`/`BR-027` and next-bowler selection are left to
 * the caller/orchestration layer, out of this pure function's scope.
 */
data class OverUpdateResult(
    val overState: OverState,
    val isOverComplete: Boolean,
    /** Meaningful only when [isOverComplete] is true. */
    val wasMaidenOver: Boolean,
)

fun updateOverState(
    current: OverState,
    legality: Legality,
    consumesLegalBallSlot: Boolean,
    runAggregate: RunAggregate,
    profile: PlayingConditionsProfile,
): OverUpdateResult {
    // §13.3: byes/leg-byes/penalty runs don't break a maiden; only a
    // batter run (batterRuns != 0) or an illegal delivery (WIDE/NO_BALL)
    // does. `batterRuns` already excludes byes/leg-byes/penalty by
    // construction (§7.2), so no extra filtering is needed here.
    val breaksMaiden = legality == Legality.WIDE || legality == Legality.NO_BALL || runAggregate.batterRuns != 0

    val updated = current.copy(
        legalBallCount = current.legalBallCount + if (consumesLegalBallSlot) 1 else 0,
        // §13.2: the RAW §7.2 total, unlike InningsScoreState.totalRuns --
        // no fielding-side-penalty exclusion applies to runsThisOver.
        runsThisOver = current.runsThisOver + runAggregate.total,
        isMaidenSoFar = current.isMaidenSoFar && !breaksMaiden,
    )

    val isComplete = updated.legalBallCount == profile.ballsPerOver
    return OverUpdateResult(
        overState = updated,
        isOverComplete = isComplete,
        wasMaidenOver = isComplete && updated.isMaidenSoFar,
    )
}
