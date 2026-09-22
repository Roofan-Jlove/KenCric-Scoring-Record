package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.InningsEndReason
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * live-scoring.md §15, all three delivery-triggered ending conditions
 * plus their fixed priority order and §22.8 EX-11's effective-threshold
 * reduction.
 */
class InningsEndEvaluatorTest {

    private fun evaluate(
        wicketsLost: Int = 3,
        maxWicketsPerInnings: Int = 10,
        retiredNotOutOrAbsentCount: Int = 0,
        legalBallsBowled: Int = 50,
        oversAllotted: Int = 20,
        ballsPerOver: Int = 6,
        totalRuns: Int = 80,
        target: Int? = null,
    ) = evaluateInningsEnd(
        wicketsLost, maxWicketsPerInnings, retiredNotOutOrAbsentCount,
        legalBallsBowled, oversAllotted, ballsPerOver, totalRuns, target,
    )

    @Test fun not_ended_by_any_condition_returns_null() {
        assertNull(evaluate())
    }

    @Test fun all_out_at_full_threshold() {
        assertEquals(InningsEndReason.ALL_OUT, evaluate(wicketsLost = 10, maxWicketsPerInnings = 10))
    }

    @Test fun below_threshold_does_not_trigger_all_out() {
        assertNull(evaluate(wicketsLost = 9, maxWicketsPerInnings = 10, legalBallsBowled = 50))
    }

    // EX-11 (§22.10): a RETIRED_NOT_OUT batter reduces the effective
    // all-out threshold by 1 -- 9 wickets down with one batter
    // unavailable is effectively all out, same as 10 wickets normally.
    @Test fun ex11_retired_not_out_reduces_effective_all_out_threshold() {
        assertEquals(
            InningsEndReason.ALL_OUT,
            evaluate(wicketsLost = 9, maxWicketsPerInnings = 10, retiredNotOutOrAbsentCount = 1),
        )
    }

    @Test fun overs_complete_at_exact_allotment() {
        assertEquals(
            InningsEndReason.OVERS_COMPLETE,
            evaluate(legalBallsBowled = 120, oversAllotted = 20, ballsPerOver = 6, wicketsLost = 4),
        )
    }

    // Expected behavior (task backlog): a chase reaching the target
    // mid-over ends the innings immediately, evaluated deterministically
    // from state alone -- not gated on over completion.
    @Test fun target_reached_mid_over_ends_immediately() {
        assertEquals(
            InningsEndReason.TARGET_REACHED,
            evaluate(totalRuns = 151, target = 150, legalBallsBowled = 113, oversAllotted = 20, ballsPerOver = 6),
        )
    }

    @Test fun target_exactly_equalled_also_ends_the_innings() {
        assertEquals(InningsEndReason.TARGET_REACHED, evaluate(totalRuns = 150, target = 150))
    }

    @Test fun no_target_set_never_triggers_target_reached() {
        assertNull(evaluate(totalRuns = 999, target = null))
    }

    // Priority order: all-out is checked first and wins even when the
    // target has also technically been reached on the same delivery.
    @Test fun all_out_takes_priority_over_target_reached() {
        assertEquals(
            InningsEndReason.ALL_OUT,
            evaluate(wicketsLost = 10, maxWicketsPerInnings = 10, totalRuns = 200, target = 150),
        )
    }

    // Priority order: overs-complete is checked before target-reached.
    @Test fun overs_complete_takes_priority_over_target_reached() {
        assertEquals(
            InningsEndReason.OVERS_COMPLETE,
            evaluate(legalBallsBowled = 120, oversAllotted = 20, ballsPerOver = 6, totalRuns = 200, target = 150),
        )
    }
}
