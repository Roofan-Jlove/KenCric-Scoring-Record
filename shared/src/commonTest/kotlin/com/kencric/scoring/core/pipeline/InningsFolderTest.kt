package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.config.PlayingConditionsProfile
import com.kencric.scoring.core.model.BatterCardLine
import com.kencric.scoring.core.model.BatterStatus
import com.kencric.scoring.core.model.BowlerCardLine
import com.kencric.scoring.core.model.CreaseEnd
import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsEndReason
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.model.InningsScoreState
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.OverState
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.BOUNDARY
import com.kencric.scoring.core.model.RunEventMethod.RUN
import com.kencric.scoring.core.model.RunEventOrigin.OFF_BAT
import com.kencric.scoring.core.model.WicketDetail
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * live-scoring.md §18.1: "Undo is defined once, uniformly." The core
 * property under test throughout is that `undoLastDelivery` (fold with
 * one fewer active delivery) reproduces EXACTLY the state that existed
 * before the undone delivery was ever applied -- verified both against
 * real §22 worked examples and by comparing incremental step-by-step
 * folding against batch dropLast-based folding.
 */
class InningsFolderTest {

    private val profile = PlayingConditionsProfile(ballsPerOver = 6)
    private val config = FoldConfig(profile = profile, bowlingTeamId = "fielding", maxWicketsPerInnings = 10, oversAllotted = 20, target = null)

    private val genesis = InningsFoldState(
        batterCardLines = emptyMap(),
        bowlerCardLines = emptyMap(),
        score = InningsScoreState(totalRuns = 61, wicketsLost = 2),
        over = OverState(overNumber = 8, bowlerId = "X", legalBallCount = 3),
        strikerBatterId = "A",
        nonStrikerBatterId = "B",
        freeHitPending = false,
        inningsEndReason = null,
    )

    private fun legalDelivery(runEvents: List<RunEvent> = emptyList()) = DeliveryInput(
        legality = Legality.LEGAL, strikerBatterId = "A", nonStrikerBatterId = "B",
        bowlerId = "X", isFreeHit = false, runEvents = runEvents,
    )

    // EX-01: dot ball folds to exactly the stated figures.
    @Test fun ex01_dot_ball_folds_correctly() {
        val result = foldInnings(genesis, listOf(legalDelivery()), config)
        assertEquals(1, result.batterCardLines["A"]?.ballsFaced)
        assertEquals(1, result.bowlerCardLines["X"]?.legalBallsBowled)
        assertEquals(4, result.over.legalBallCount)
        assertEquals("A", result.strikerBatterId)
    }

    // EX-01's own Undo claim: "voids this event; refold restores
    // over.ball to 8.2, A's ballsFaced -1, X's legalBallsBowled -1."
    @Test fun ex01_undo_restores_the_exact_pre_state() {
        val deliveries = listOf(legalDelivery())
        val afterUndo = undoLastDelivery(genesis, deliveries, config)
        assertEquals(genesis, afterUndo)
    }

    // EX-03: boundary six on the over's final ball completes the over
    // and rotates strike purely from the end-of-over swap.
    @Test fun ex03_boundary_six_completes_over_and_rotates_strike() {
        val stateAtBall5 = genesis.copy(over = genesis.over.copy(legalBallCount = 5))
        val result = foldInnings(stateAtBall5, listOf(legalDelivery(listOf(RunEvent(OFF_BAT, 6, BOUNDARY)))), config)
        assertEquals(6, result.over.legalBallCount)
        assertEquals(9, result.over.overNumber)
        assertEquals("B", result.strikerBatterId, "B becomes striker for over 9 purely from the end-of-over swap")
        assertEquals("A", result.nonStrikerBatterId)
    }

    // EX-04: single on the over's final ball -- the run-swap and the
    // end-swap cancel, A retains strike. The pair EX-03/EX-04 together
    // is the flagship over-boundary parity case.
    @Test fun ex04_single_on_final_ball_cancels_to_no_rotation() {
        val stateAtBall5 = genesis.copy(over = genesis.over.copy(legalBallCount = 5))
        val result = foldInnings(stateAtBall5, listOf(legalDelivery(listOf(RunEvent(OFF_BAT, 1, RUN)))), config)
        assertEquals(6, result.over.legalBallCount)
        assertEquals("A", result.strikerBatterId, "the run-swap and end-swap cancel -- A retains strike")
    }

    // EX-12 (§22.11): Undo across an over boundary. legalBallCount,
    // overNumber, and strike must ALL revert together automatically,
    // with no bespoke "un-complete the over" code -- exactly the
    // property foldInnings/undoLastDelivery give for free.
    @Test fun ex12_undo_across_an_over_boundary_reverts_everything_together() {
        val stateAtBall5 = genesis.copy(over = genesis.over.copy(legalBallCount = 5))
        val sixDelivery = legalDelivery(listOf(RunEvent(OFF_BAT, 6, BOUNDARY)))

        val afterSix = foldInnings(stateAtBall5, listOf(sixDelivery), config)
        assertEquals(6, afterSix.over.legalBallCount)
        assertEquals(9, afterSix.over.overNumber)
        assertEquals("B", afterSix.strikerBatterId)

        val afterUndo = undoLastDelivery(stateAtBall5, listOf(sixDelivery), config)
        assertEquals(stateAtBall5, afterUndo, "over/strike/score must all revert together -- byte-identical to the pre-six state")
        assertEquals(5, afterUndo.over.legalBallCount, "over not complete -- reverted, not merely decremented")
        assertEquals(8, afterUndo.over.overNumber)
        assertEquals("A", afterUndo.strikerBatterId)
    }

    // EX-08: caught. Undo must remove the incoming batter's card line
    // entirely (it never existed in the active fold) and restore the
    // outgoing batter to NOT_OUT with figures exactly as before.
    @Test fun ex08_caught_and_its_undo() {
        val delivery = legalDelivery().copy(
            wicket = WicketDetail(mode = DismissalMode.CAUGHT, outBatterId = "A", endVacated = CreaseEnd.STRIKER, incomingBatterId = "C"),
        )
        val afterCatch = foldInnings(genesis, listOf(delivery), config)
        assertEquals("C", afterCatch.strikerBatterId, "C occupies the striker's end")
        assertEquals("B", afterCatch.nonStrikerBatterId, "B remains non-striker, unaffected")
        assertEquals(BatterStatus.OUT, afterCatch.batterCardLines["A"]?.status)
        assertEquals(1, afterCatch.bowlerCardLines["X"]?.wickets, "CAUGHT credits the bowler (§9.4)")

        val afterUndo = undoLastDelivery(genesis, listOf(delivery), config)
        assertEquals(genesis, afterUndo)
        assertNull(afterUndo.batterCardLines["C"], "C's card line never existed in the refolded active set")
    }

    // The general byte-identical-refold property (this task's own
    // Verification procedure), checked against a longer, mixed sequence
    // -- not just single-delivery cases.
    @Test fun incremental_and_batch_folding_agree_at_every_step() {
        val deliveries = listOf(
            legalDelivery(listOf(RunEvent(OFF_BAT, 1, RUN))),
            legalDelivery(listOf(RunEvent(OFF_BAT, 4, BOUNDARY))),
            legalDelivery(),
            legalDelivery().copy(
                wicket = WicketDetail(mode = DismissalMode.BOWLED, outBatterId = "A", endVacated = CreaseEnd.STRIKER, incomingBatterId = "C"),
            ),
        )
        for (n in deliveries.indices) {
            val batch = foldInnings(genesis, deliveries.take(n + 1), config)
            val incremental = foldInnings(foldInnings(genesis, deliveries.take(n), config), listOf(deliveries[n]), config)
            assertEquals(batch, incremental, "batch fold and one-more-step incremental fold must agree at step ${n + 1}")
        }
        // Undoing the last of the four deliveries must reproduce exactly
        // the batch fold of the first three.
        assertEquals(foldInnings(genesis, deliveries.take(3), config), undoLastDelivery(genesis, deliveries, config))
    }

    @Test fun free_hit_pending_is_set_by_no_ball_and_consumed_by_the_next_legal_delivery() {
        val freeHitProfile = profile.copy(freeHitOnNoBall = true)
        val freeHitConfig = config.copy(profile = freeHitProfile)
        val noBall = legalDelivery().copy(legality = Legality.NO_BALL)
        val afterNoBall = foldInnings(genesis, listOf(noBall), freeHitConfig)
        assertEquals(true, afterNoBall.freeHitPending)

        val afterLegal = foldInnings(afterNoBall, listOf(freeHitLegalDelivery()), freeHitConfig)
        assertEquals(false, afterLegal.freeHitPending, "consumed by the next legal delivery")
    }

    private fun freeHitLegalDelivery() = DeliveryInput(
        legality = Legality.LEGAL, strikerBatterId = "A", nonStrikerBatterId = "B",
        bowlerId = "X", isFreeHit = true,
    )

    @Test fun innings_end_stops_the_fold_from_changing_state_further() {
        val nearAllOut = genesis.copy(score = genesis.score.copy(wicketsLost = 9))
        val theTenthWicket = legalDelivery().copy(
            wicket = WicketDetail(mode = DismissalMode.BOWLED, outBatterId = "A", endVacated = CreaseEnd.STRIKER, incomingBatterId = null),
        )
        val afterAllOut = foldInnings(nearAllOut, listOf(theTenthWicket), config)
        assertEquals(InningsEndReason.ALL_OUT, afterAllOut.inningsEndReason)

        // A further delivery after all-out must not change state at all.
        val afterAnotherDelivery = foldInnings(afterAllOut, listOf(legalDelivery(listOf(RunEvent(OFF_BAT, 4, BOUNDARY)))), config)
        assertEquals(afterAllOut, afterAnotherDelivery)
    }
}
