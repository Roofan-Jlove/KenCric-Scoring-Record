package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.config.PlayingConditionsProfile
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.InningsScoreState
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.OverState
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.AUTOMATIC
import com.kencric.scoring.core.model.RunEventMethod.BOUNDARY
import com.kencric.scoring.core.model.RunEventMethod.RUN
import com.kencric.scoring.core.model.RunEventOrigin.NO_BALL_BAT
import com.kencric.scoring.core.model.RunEventOrigin.NO_BALL_PENALTY
import com.kencric.scoring.core.model.RunEventOrigin.OFF_BAT
import com.kencric.scoring.core.model.RunEventOrigin.PENALTY
import com.kencric.scoring.core.model.RunEventOrigin.WIDE
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * live-scoring.md §12-§13, cross-checked by hand against every §22
 * worked example reporting team-score/over-state figures: EX-01, 02, 03,
 * 04 (the flagship over-boundary parity pair), 05, 06, 07, 08.
 */
class InningsOverStateUpdaterTest {

    private val sixBallProfile = PlayingConditionsProfile(ballsPerOver = 6)
    private val overAtBall3 = OverState(overNumber = 8, bowlerId = "X", legalBallCount = 3)
    private val overAtBall5 = OverState(overNumber = 8, bowlerId = "X", legalBallCount = 5)

    // EX-01: dot ball -- legalBallCount 3->4, runsThisOver unchanged, not complete.
    @Test fun ex01_dot_ball_over_state() {
        val aggregate = aggregateRuns(emptyList())
        val result = updateOverState(overAtBall3, Legality.LEGAL, consumesLegalBallSlot = true, aggregate, sixBallProfile)
        assertEquals(4, result.overState.legalBallCount)
        assertEquals(0, result.overState.runsThisOver)
        assertFalse(result.isOverComplete)
    }

    // EX-02: single -- legalBallCount 3->4, runsThisOver +1, totalRuns +1.
    @Test fun ex02_single_score_and_over_state() {
        val runEvents = listOf(RunEvent(OFF_BAT, 1, RUN))
        val aggregate = aggregateRuns(runEvents)

        val overResult = updateOverState(overAtBall3, Legality.LEGAL, consumesLegalBallSlot = true, aggregate, sixBallProfile)
        assertEquals(4, overResult.overState.legalBallCount)
        assertEquals(1, overResult.overState.runsThisOver)

        val score = updateInningsScoreState(InningsScoreState(), runEvents, aggregate, bowlingTeamId = "fielding", consumesLegalBallSlot = true, dismissalMode = null)
        assertEquals(1, score.totalRuns)
    }

    // EX-03/EX-04: the flagship over-boundary parity pair -- both complete
    // the over on legalBallCount 5->6, regardless of how the runs arose.
    @Test fun ex03_boundary_six_completes_the_over() {
        val runEvents = listOf(RunEvent(OFF_BAT, 6, BOUNDARY))
        val aggregate = aggregateRuns(runEvents)
        val result = updateOverState(overAtBall5, Legality.LEGAL, consumesLegalBallSlot = true, aggregate, sixBallProfile)
        assertEquals(6, result.overState.legalBallCount)
        assertEquals(6, result.overState.runsThisOver)
        assertTrue(result.isOverComplete)
        assertFalse(result.wasMaidenOver, "a struck six breaks the maiden")
    }

    @Test fun ex04_single_on_last_ball_also_completes_the_over() {
        val runEvents = listOf(RunEvent(OFF_BAT, 1, RUN))
        val aggregate = aggregateRuns(runEvents)
        val result = updateOverState(overAtBall5, Legality.LEGAL, consumesLegalBallSlot = true, aggregate, sixBallProfile)
        assertEquals(6, result.overState.legalBallCount)
        assertTrue(result.isOverComplete, "over completion is purely legalBallCount == ballsPerOver -- unaffected by run value")
    }

    // EX-05: wide to the boundary -- legalBallCount unchanged (wides never
    // consume a slot), runsThisOver +4, totalRuns +4, extras.wides +4.
    @Test fun ex05_wide_to_the_boundary() {
        val runEvents = listOf(RunEvent(WIDE, 4, BOUNDARY))
        val aggregate = aggregateRuns(runEvents)

        val overResult = updateOverState(overAtBall3, Legality.WIDE, consumesLegalBallSlot = false, aggregate, sixBallProfile)
        assertEquals(3, overResult.overState.legalBallCount, "wides never consume a legal-ball slot")
        assertEquals(4, overResult.overState.runsThisOver)
        assertFalse(overResult.overState.isMaidenSoFar, "a wide always breaks the maiden (§13.3)")

        val score = updateInningsScoreState(InningsScoreState(totalRuns = 61), runEvents, aggregate, bowlingTeamId = "fielding", consumesLegalBallSlot = false, dismissalMode = null)
        assertEquals(65, score.totalRuns)
        assertEquals(4, score.wides)
    }

    // EX-06: no-ball hit for four -- legalBallCount unchanged, runsThisOver
    // +5, totalRuns +5, extras.noBalls +1, maiden permanently broken.
    @Test fun ex06_no_ball_hit_for_four() {
        val runEvents = listOf(RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC), RunEvent(NO_BALL_BAT, 4, BOUNDARY))
        val aggregate = aggregateRuns(runEvents)

        val overResult = updateOverState(overAtBall3, Legality.NO_BALL, consumesLegalBallSlot = false, aggregate, sixBallProfile)
        assertEquals(3, overResult.overState.legalBallCount)
        assertEquals(5, overResult.overState.runsThisOver)
        assertFalse(overResult.overState.isMaidenSoFar, "a no-ball permanently breaks the maiden, even though its runs came off the bat")

        val score = updateInningsScoreState(InningsScoreState(), runEvents, aggregate, bowlingTeamId = "fielding", consumesLegalBallSlot = false, dismissalMode = null)
        assertEquals(5, score.totalRuns)
        assertEquals(1, score.noBalls)
    }

    // EX-07: totalRuns +1, wicketsLost +1 (RUN_OUT is a real dismissal).
    @Test fun ex07_run_out_updates_score_and_wickets() {
        val runEvents = listOf(RunEvent(OFF_BAT, 1, RUN))
        val aggregate = aggregateRuns(runEvents)
        val score = updateInningsScoreState(InningsScoreState(), runEvents, aggregate, bowlingTeamId = "fielding", consumesLegalBallSlot = true, dismissalMode = DismissalMode.RUN_OUT)
        assertEquals(1, score.totalRuns)
        assertEquals(1, score.wicketsLost)
    }

    // EX-08: caught -- totalRuns unchanged, wicketsLost +1.
    @Test fun ex08_caught_updates_wickets_not_runs() {
        val aggregate = aggregateRuns(emptyList())
        val score = updateInningsScoreState(InningsScoreState(), emptyList(), aggregate, bowlingTeamId = "fielding", consumesLegalBallSlot = true, dismissalMode = DismissalMode.CAUGHT)
        assertEquals(0, score.totalRuns)
        assertEquals(1, score.wicketsLost)
    }

    // Not from a §22 worked example -- constructed directly from §7.7's
    // text (no fully worked example covers a fielding-side penalty):
    // a 5-run PENALTY awarded to the FIELDING side must NOT inflate the
    // batting side's totalRuns, even though it's still recorded in the
    // extras.penalty bucket per §12's own unconditional wording.
    @Test fun penalty_awarded_to_fielding_side_excluded_from_batting_total() {
        val runEvents = listOf(RunEvent(PENALTY, 5, AUTOMATIC, awardedToTeamId = "fielding-team"))
        val aggregate = aggregateRuns(runEvents)
        val score = updateInningsScoreState(InningsScoreState(totalRuns = 61), runEvents, aggregate, bowlingTeamId = "fielding-team", consumesLegalBallSlot = false, dismissalMode = null)
        assertEquals(61, score.totalRuns, "a penalty awarded to the fielding side must not inflate the batting side's total (§7.7)")
        assertEquals(5, score.penalty, "still recorded in extras.penalty regardless of which side it benefits")
    }

    @Test fun penalty_awarded_to_batting_side_does_inflate_the_total() {
        val runEvents = listOf(RunEvent(PENALTY, 5, AUTOMATIC, awardedToTeamId = "batting-team"))
        val aggregate = aggregateRuns(runEvents)
        val score = updateInningsScoreState(InningsScoreState(totalRuns = 61), runEvents, aggregate, bowlingTeamId = "fielding-team", consumesLegalBallSlot = false, dismissalMode = null)
        assertEquals(66, score.totalRuns)
    }
}
