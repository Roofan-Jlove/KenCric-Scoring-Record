package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.BatterCardLine
import com.kencric.scoring.core.model.BowlerCardLine
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod
import com.kencric.scoring.core.model.RunEventOrigin

// §10: fours/sixes only count a genuine boundary struck by the batter --
// the same origin set §7.2 already treats as batter runs (OFF_BAT,
// NO_BALL_BAT). A boundary run through byes/leg-byes/wides never reaches
// this set at all.
private val BATTER_BOUNDARY_ORIGINS = setOf(RunEventOrigin.OFF_BAT, RunEventOrigin.NO_BALL_BAT)

/**
 * live-scoring.md §10 (Step 6), applied to the striker's BatterCardLine.
 * The non-striker's line is untouched by a normal delivery (§10's own
 * text) -- callers pick which BatterCardLine to pass in; this function
 * doesn't know about strike position at all.
 *
 * `runEvents` must be the SAME list [runAggregate] was computed from --
 * needed separately because fours/sixes require inspecting individual
 * events (§10's "exactly one RunEvent exists with ..." condition),
 * which RunAggregate's summed totals don't preserve.
 *
 * HONEST SCOPE NOTE: does not set `status`/`dismissal` -- see
 * BatterCardLine's own doc comment.
 */
fun updateBatterCardLine(
    current: BatterCardLine,
    runAggregate: RunAggregate,
    incrementsBallsFaced: Boolean,
    runEvents: List<RunEvent>,
): BatterCardLine {
    val matchingFours = runEvents.count {
        it.origin in BATTER_BOUNDARY_ORIGINS && it.method == RunEventMethod.BOUNDARY && it.value == 4
    }
    val matchingSixes = runEvents.count {
        it.origin in BATTER_BOUNDARY_ORIGINS && it.method == RunEventMethod.BOUNDARY && it.value == 6
    }
    return current.copy(
        runs = current.runs + runAggregate.batterRuns,
        ballsFaced = current.ballsFaced + if (incrementsBallsFaced) 1 else 0,
        fours = current.fours + if (matchingFours == 1) 1 else 0,
        sixes = current.sixes + if (matchingSixes == 1) 1 else 0,
    )
}

/**
 * live-scoring.md §11 (Step 7), applied to the bowler's BowlerCardLine.
 * `maidens` is intentionally never touched here -- see BowlerCardLine's
 * own doc comment (§13.3, over-completion scope, not per-delivery).
 */
fun updateBowlerCardLine(
    current: BowlerCardLine,
    legality: Legality,
    runAggregate: RunAggregate,
    consumesLegalBallSlot: Boolean,
    creditsWicketToBowler: Boolean,
): BowlerCardLine {
    val widesThisDelivery = runAggregate.extras[ExtrasCategory.WIDES] ?: 0
    return current.copy(
        legalBallsBowled = current.legalBallsBowled + if (consumesLegalBallSlot) 1 else 0,
        runsCharged = current.runsCharged + runAggregate.bowlerRunsCharged,
        wickets = current.wickets + if (creditsWicketToBowler) 1 else 0,
        widesBowled = current.widesBowled + widesThisDelivery,
        noBallsBowled = current.noBallsBowled + if (legality == Legality.NO_BALL) 1 else 0,
    )
}

/** §11's `oversBowled` display row: derived, never stored independently. */
fun oversBowledDisplay(legalBallsBowled: Int, ballsPerOver: Int): String {
    val wholeOvers = legalBallsBowled / ballsPerOver
    val remainder = legalBallsBowled % ballsPerOver
    return "$wholeOvers.$remainder"
}
