package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod
import com.kencric.scoring.core.model.RunEventOrigin

/** live-scoring.md §7.2's extras-category mapping. */
enum class ExtrasCategory { BYES, LEG_BYES, WIDES, NO_BALLS, PENALTY }

/**
 * live-scoring.md §7.2: the five aggregate figures computed from a
 * delivery's RunEvents. Deliberately does NOT apply the shortRuns
 * deduction (§8) -- that's TASK-0020's separately-listed scope; this
 * task computes the raw aggregates §7.2 itself defines.
 */
data class RunAggregate(
    val total: Int,
    val batterRuns: Int,
    val extras: Map<ExtrasCategory, Int>,
    val bowlerRunsCharged: Int,
    /** Used only for strike rotation (§14, not this task's scope). */
    val ranRuns: Int,
)

// §7.2: "NO_BALL_BAT is not an extra -- it is batter runs, exactly like
// OFF_BAT." The no-ball's own penalty (NO_BALL_PENALTY) is the only part
// of a no-ball that is itself an extra.
private val BATTER_RUN_ORIGINS = setOf(RunEventOrigin.OFF_BAT, RunEventOrigin.NO_BALL_BAT)

// §7.2: bowlerRunsCharged = everything except byes, leg-byes (any form,
// including on a no-ball) and penalty runs.
private val BOWLER_CHARGED_ORIGINS = setOf(
    RunEventOrigin.OFF_BAT,
    RunEventOrigin.NO_BALL_PENALTY,
    RunEventOrigin.NO_BALL_BAT,
    RunEventOrigin.WIDE,
)

// §7.2's exact category mapping, including the two "goes to the byes/
// leg-byes bucket even though it happened on a no-ball" cases ([PRD]).
private val EXTRAS_CATEGORY: Map<RunEventOrigin, ExtrasCategory> = mapOf(
    RunEventOrigin.BYE to ExtrasCategory.BYES,
    RunEventOrigin.LEG_BYE to ExtrasCategory.LEG_BYES,
    RunEventOrigin.WIDE to ExtrasCategory.WIDES,
    RunEventOrigin.NO_BALL_PENALTY to ExtrasCategory.NO_BALLS,
    RunEventOrigin.NO_BALL_BYE to ExtrasCategory.BYES,
    RunEventOrigin.NO_BALL_LEG_BYE to ExtrasCategory.LEG_BYES,
    RunEventOrigin.PENALTY to ExtrasCategory.PENALTY,
    // OFF_BAT and NO_BALL_BAT intentionally absent -- not extras (§7.2).
)

/**
 * §7.2's five formulas, applied uniformly to any RunEvent list -- every
 * run scenario (off the bat, byes, leg-byes, wides, no-ball penalties,
 * no-ball-plus-byes, penalties, overthrows, and every combination) is
 * covered by these same formulas, nothing hard-coded per scenario. The
 * §7.6 "boundary subsumes" rule needs no special handling here: it's
 * already expressed by which RunEvents the caller constructs (one
 * RunEvent(value=4) for a boundary wide, not a separate automatic-1 plus
 * a boundary-4), not by extra logic in this aggregator.
 */
fun aggregateRuns(runEvents: List<RunEvent>): RunAggregate {
    val total = runEvents.sumOf { it.value }
    val batterRuns = runEvents.filter { it.origin in BATTER_RUN_ORIGINS }.sumOf { it.value }
    val bowlerRunsCharged = runEvents.filter { it.origin in BOWLER_CHARGED_ORIGINS }.sumOf { it.value }
    val ranRuns = runEvents.filter { it.method == RunEventMethod.RUN }.sumOf { it.value }

    val extras = mutableMapOf<ExtrasCategory, Int>()
    for (event in runEvents) {
        val category = EXTRAS_CATEGORY[event.origin] ?: continue
        extras[category] = (extras[category] ?: 0) + event.value
    }

    return RunAggregate(
        total = total,
        batterRuns = batterRuns,
        extras = extras,
        bowlerRunsCharged = bowlerRunsCharged,
        ranRuns = ranRuns,
    )
}
