package com.kencric.scoring.ui.screens.ux10livescoring

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0056`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-10-live-scoring/liveScoringDisplay.test.ts`
 * (`TASK-0055`) input-for-input.
 */
class LiveScoringDisplayTest {

    @Test fun formatOvers_renders_the_ob_display_notation_not_a_decimal() {
        assertEquals("12.3", formatOvers(75, 6))
    }

    @Test fun oversAsDecimal_computes_the_true_decimal_not_the_ob_notation_misread() {
        // 75 legal balls at 6/over = 12 completed overs + 3 balls = 12.5 decimal overs, not 12.3.
        assertEquals(12.5, oversAsDecimal(75, 6))
    }

    @Test fun a_completed_over_boundary_formats_with_zero_balls_into_the_next_over() {
        assertEquals("12.0", formatOvers(72, 6))
        assertEquals(12.0, oversAsDecimal(72, 6))
    }

    @Test fun computeRunRate_computes_runs_over_true_decimal_overs() {
        // 90 runs off 75 balls (12.5 decimal overs) = 7.2, NOT 90/12.3.
        assertEquals(7.2, computeRunRate(90, 75, 6))
    }

    @Test fun computeRunRate_is_null_at_zero_balls_bowled() {
        assertNull(computeRunRate(0, 0, 6))
    }

    @Test fun computeRunsRequired_is_null_in_the_first_innings() {
        assertNull(computeRunsRequired(null, 90))
    }

    @Test fun computeRunsRequired_matches_target_minus_current_runs_floored_at_zero() {
        assertEquals(60, computeRunsRequired(150, 90))
        assertEquals(0, computeRunsRequired(150, 160))
    }

    @Test fun computeBallsRemaining_matches_total_allotted_minus_bowled_floored_at_zero() {
        assertEquals(45, computeBallsRemaining(120, 75))
        assertEquals(0, computeBallsRemaining(120, 130))
    }

    @Test fun computeRequiredRunRate_matches_run_013() {
        // 60 required off 45 balls remaining (7.5 decimal overs) = 8.
        assertEquals(8.0, computeRequiredRunRate(60, 45, 6))
    }

    @Test fun computeRequiredRunRate_is_null_with_no_target() {
        assertNull(computeRequiredRunRate(null, 45, 6))
    }

    @Test fun computeRequiredRunRate_is_null_with_zero_balls_remaining() {
        assertNull(computeRequiredRunRate(10, 0, 6))
    }

    @Test fun a_live_chase_updates_correctly_delivery_by_delivery() {
        val beforeRunsRequired = computeRunsRequired(150, 90)
        val beforeBallsRemaining = computeBallsRemaining(120, 75)
        val afterRunsRequired = computeRunsRequired(150, 94)
        val afterBallsRemaining = computeBallsRemaining(120, 76)
        assertTrue((afterRunsRequired ?: 0) < (beforeRunsRequired ?: 0))
        assertTrue(afterBallsRemaining < beforeBallsRemaining)
    }

    private val baseStateInputs = ScoringStateInputs(
        legalBallsBowled = 0,
        isBetweenOvers = false,
        isInningsBreak = false,
        isPaused = false,
        isReconciliationBlocked = false,
        isComplete = false,
    )

    @Test fun pre_first_ball_when_no_legal_balls_bowled_and_nothing_else_applies() {
        assertEquals(ScoringState.PRE_FIRST_BALL, deriveScoringState(baseStateInputs))
    }

    @Test fun active_once_legal_balls_bowled_and_nothing_else_applies() {
        assertEquals(ScoringState.ACTIVE, deriveScoringState(baseStateInputs.copy(legalBallsBowled = 12)))
    }

    @Test fun between_overs_takes_priority_over_active() {
        assertEquals(
            ScoringState.BETWEEN_OVERS,
            deriveScoringState(baseStateInputs.copy(legalBallsBowled = 12, isBetweenOvers = true)),
        )
    }

    @Test fun paused_takes_priority_over_between_overs() {
        assertEquals(
            ScoringState.PAUSED,
            deriveScoringState(baseStateInputs.copy(legalBallsBowled = 12, isBetweenOvers = true, isPaused = true)),
        )
    }

    @Test fun reconciliation_blocked_takes_priority_over_paused() {
        assertEquals(
            ScoringState.RECONCILIATION_BLOCKED,
            deriveScoringState(baseStateInputs.copy(legalBallsBowled = 12, isPaused = true, isReconciliationBlocked = true)),
        )
    }

    @Test fun complete_takes_priority_over_everything_else() {
        assertEquals(
            ScoringState.COMPLETE,
            deriveScoringState(baseStateInputs.copy(legalBallsBowled = 12, isReconciliationBlocked = true, isComplete = true)),
        )
    }

    @Test fun isChasing_is_false_in_the_first_innings_even_with_a_target_present() {
        assertFalse(isChasing(1, 150))
    }

    @Test fun isChasing_is_false_in_the_second_innings_with_no_target_set_yet() {
        assertFalse(isChasing(2, null))
    }

    @Test fun isChasing_is_true_in_the_second_innings_once_a_target_is_set() {
        assertTrue(isChasing(2, 150))
    }
}
