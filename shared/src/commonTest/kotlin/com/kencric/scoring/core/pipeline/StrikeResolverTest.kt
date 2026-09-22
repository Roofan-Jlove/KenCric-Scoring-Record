package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.BOUNDARY
import com.kencric.scoring.core.model.RunEventMethod.RUN
import com.kencric.scoring.core.model.RunEventOrigin.OFF_BAT
import com.kencric.scoring.core.model.RunEventOrigin.WIDE
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * live-scoring.md §14.2, all four XOR truth-table combinations, each
 * traced against a real §22 worked example rather than a synthetic
 * case: EX-01 (even, not-final), EX-02 (odd, not-final), EX-03 (even,
 * final -- the flagship "gotcha"), EX-04 (odd, final -- its pair), and
 * EX-05 (a wide can never be "the over's final ball" by definition).
 */
class StrikeResolverTest {

    // EX-01: dot ball, not the over's final ball -> no rotation.
    @Test fun ex01_even_not_final_no_rotation() {
        val ranRuns = aggregateRuns(emptyList()).ranRuns
        assertFalse(resolvesStrikeRotation(ranRuns, isOverFinalLegalBall = false))
    }

    // EX-02: single, not the over's final ball -> rotates.
    @Test fun ex02_odd_not_final_rotates() {
        val ranRuns = aggregateRuns(listOf(RunEvent(OFF_BAT, 1, RUN))).ranRuns
        assertTrue(resolvesStrikeRotation(ranRuns, isOverFinalLegalBall = false))
    }

    // EX-03: boundary six (0 ranRuns -- method=BOUNDARY never contributes,
    // §7.5/§14.4) on the over's final ball -> rotates purely from the
    // end-of-over swap, even though nobody ran. "B becomes striker."
    @Test fun ex03_even_final_rotates_purely_from_over_end() {
        val ranRuns = aggregateRuns(listOf(RunEvent(OFF_BAT, 6, BOUNDARY))).ranRuns
        assertEquals(0, ranRuns, "a boundary contributes zero to ranRuns")
        assertTrue(resolvesStrikeRotation(ranRuns, isOverFinalLegalBall = true))
    }

    // EX-04: single on the over's final ball -> the run-swap and the
    // end-swap cancel. "A retains strike" -- the case most often gotten backward.
    @Test fun ex04_odd_final_cancels_to_no_rotation() {
        val ranRuns = aggregateRuns(listOf(RunEvent(OFF_BAT, 1, RUN))).ranRuns
        assertFalse(resolvesStrikeRotation(ranRuns, isOverFinalLegalBall = true))
    }

    // EX-05: wide to the boundary -- a wide can never be "the over's
    // final ball" (never consumes a slot at all, §14.2's own text) and
    // its automatic run contributes zero to ranRuns -> no rotation.
    @Test fun ex05_wide_never_final_no_rotation() {
        val ranRuns = aggregateRuns(listOf(RunEvent(WIDE, 4, BOUNDARY))).ranRuns
        assertFalse(resolvesStrikeRotation(ranRuns, isOverFinalLegalBall = false))
    }

    @Test fun apply_strike_rotation_swaps_only_when_net_rotates() {
        val positions = StrikePositions(strikerBatterId = "A", nonStrikerBatterId = "B")
        assertEquals(StrikePositions("B", "A"), applyStrikeRotation(positions, netRotates = true))
        assertEquals(positions, applyStrikeRotation(positions, netRotates = false))
    }
}
