package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod
import com.kencric.scoring.core.model.RunEventOrigin

/**
 * live-scoring.md §7.6-§7.8: constructs the correct RunEvent list for
 * each extras type, embodying the "boundary subsumes" / "no-ball penalty
 * always additive" construction rules. Distinct from RunAggregator
 * (TASK-0019), which sums an already-given RunEvent list -- these
 * functions decide WHICH RunEvents to build in the first place.
 */

/**
 * §7.6: a wide reaching the boundary untouched is scored as the boundary
 * value ALONE -- one RunEvent, the boundary replaces the automatic 1,
 * never both. A wide with runs actually run is the automatic 1 plus a
 * separate RUN-method event. A plain wide with neither is just the
 * automatic 1. At most one of [runsRun, reachedBoundaryValue] should be
 * non-zero/non-null -- both being set simultaneously is not a real
 * scenario per §7.6's framing, not validated here (an input-shaping
 * concern for whichever screen/command constructs the call).
 */
fun wideRunEvents(runsRun: Int = 0, reachedBoundaryValue: Int? = null): List<RunEvent> = when {
    reachedBoundaryValue != null ->
        listOf(RunEvent(RunEventOrigin.WIDE, reachedBoundaryValue, RunEventMethod.BOUNDARY))
    runsRun > 0 ->
        listOf(
            RunEvent(RunEventOrigin.WIDE, 1, RunEventMethod.AUTOMATIC),
            RunEvent(RunEventOrigin.WIDE, runsRun, RunEventMethod.RUN),
        )
    else ->
        listOf(RunEvent(RunEventOrigin.WIDE, 1, RunEventMethod.AUTOMATIC))
}

/** §7.6: the no-ball penalty run, never subsumed by anything else. */
fun noBallPenaltyEvent(): RunEvent =
    RunEvent(RunEventOrigin.NO_BALL_PENALTY, 1, RunEventMethod.AUTOMATIC)

/** §7.6: a no-ball hit by the bat is ALWAYS two events -- the penalty
 * plus whatever the bat did -- never subsumed into one, unlike a wide. */
fun noBallOffBatRunEvents(value: Int, method: RunEventMethod): List<RunEvent> =
    listOf(noBallPenaltyEvent(), RunEvent(RunEventOrigin.NO_BALL_BAT, value, method))

fun noBallByeRunEvents(value: Int, method: RunEventMethod): List<RunEvent> =
    listOf(noBallPenaltyEvent(), RunEvent(RunEventOrigin.NO_BALL_BYE, value, method))

fun noBallLegByeRunEvents(value: Int, method: RunEventMethod): List<RunEvent> =
    listOf(noBallPenaltyEvent(), RunEvent(RunEventOrigin.NO_BALL_LEG_BYE, value, method))

/** Byes/leg-byes on a LEGAL delivery -- a single event, no accompanying
 * automatic component (unlike a wide/no-ball, nothing else attaches). */
fun byeRunEvent(value: Int, method: RunEventMethod): RunEvent =
    RunEvent(RunEventOrigin.BYE, value, method)

fun legByeRunEvent(value: Int, method: RunEventMethod): RunEvent =
    RunEvent(RunEventOrigin.LEG_BYE, value, method)

/** §7.7: always value=5, method=AUTOMATIC, per BR-036. May be awarded to
 * either side -- awardedToTeamId is mandatory here, not defaulted, since
 * there is no meaningful default side. */
fun penaltyRunEvent(awardedToTeamId: String): RunEvent =
    RunEvent(RunEventOrigin.PENALTY, 5, RunEventMethod.AUTOMATIC, awardedToTeamId = awardedToTeamId)
