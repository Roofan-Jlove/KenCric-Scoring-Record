package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.*
import com.kencric.scoring.core.model.RunEventOrigin.*
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Conformance tests for live-scoring.md §21.2 (C01-C12, off-the-bat),
 * §21.3 (C13-C16, wides), §21.4 (C17-C23, no-balls) -- every case's
 * Total/BatterRuns/BowlerCharged/ranRuns column this task's formulas
 * compute (fours/sixes tallying and event emission, also shown in those
 * tables, are other tasks' scope).
 *
 * Cannot be executed in this environment -- no Kotlin toolchain exists.
 */
class RunAggregatorTest {

    @Test fun c01_dot_ball() {
        val r = aggregateRuns(emptyList())
        assertEquals(0, r.total); assertEquals(0, r.batterRuns); assertEquals(0, r.bowlerRunsCharged); assertEquals(0, r.ranRuns)
    }

    @Test fun c02_single() {
        val r = aggregateRuns(listOf(RunEvent(OFF_BAT, 1, RUN)))
        assertEquals(1, r.total); assertEquals(1, r.batterRuns); assertEquals(1, r.bowlerRunsCharged); assertEquals(1, r.ranRuns)
    }

    @Test fun c05_boundary_four() {
        val r = aggregateRuns(listOf(RunEvent(OFF_BAT, 4, BOUNDARY)))
        assertEquals(4, r.total); assertEquals(4, r.batterRuns); assertEquals(4, r.bowlerRunsCharged); assertEquals(0, r.ranRuns)
    }

    @Test fun c06_all_run_four() {
        val r = aggregateRuns(listOf(RunEvent(OFF_BAT, 4, RUN)))
        assertEquals(4, r.total); assertEquals(4, r.batterRuns); assertEquals(4, r.bowlerRunsCharged); assertEquals(4, r.ranRuns)
    }

    @Test fun c09_run_plus_overthrow() {
        // "rotation driven by the 1, not the 5" -- ranRuns must be 1, not 5.
        val r = aggregateRuns(listOf(RunEvent(OFF_BAT, 1, RUN), RunEvent(OFF_BAT, 4, OVERTHROW)))
        assertEquals(5, r.total); assertEquals(5, r.batterRuns); assertEquals(5, r.bowlerRunsCharged); assertEquals(1, r.ranRuns)
    }

    @Test fun c10_two_run_plus_overthrow_one() {
        val r = aggregateRuns(listOf(RunEvent(OFF_BAT, 2, RUN), RunEvent(OFF_BAT, 1, OVERTHROW)))
        assertEquals(3, r.total); assertEquals(3, r.batterRuns); assertEquals(3, r.bowlerRunsCharged); assertEquals(2, r.ranRuns)
    }

    @Test fun c13_plain_wide() {
        val r = aggregateRuns(listOf(RunEvent(WIDE, 1, AUTOMATIC)))
        assertEquals(1, r.total); assertEquals(0, r.batterRuns); assertEquals(1, r.bowlerRunsCharged); assertEquals(0, r.ranRuns)
        assertEquals(1, r.extras[ExtrasCategory.WIDES])
    }

    @Test fun c14_wide_plus_two_run() {
        val r = aggregateRuns(listOf(RunEvent(WIDE, 1, AUTOMATIC), RunEvent(WIDE, 2, RUN)))
        assertEquals(3, r.total); assertEquals(0, r.batterRuns); assertEquals(3, r.bowlerRunsCharged); assertEquals(2, r.ranRuns)
        assertEquals(3, r.extras[ExtrasCategory.WIDES])
    }

    @Test fun c16_wide_to_boundary_not_five() {
        // "4 (not 5 -- §7.6)": the boundary subsumes the automatic 1,
        // expressed as a single RunEvent(value=4), not two events.
        val r = aggregateRuns(listOf(RunEvent(WIDE, 4, BOUNDARY)))
        assertEquals(4, r.total); assertEquals(0, r.batterRuns); assertEquals(4, r.bowlerRunsCharged); assertEquals(0, r.ranRuns)
        assertEquals(4, r.extras[ExtrasCategory.WIDES])
    }

    @Test fun c17_plain_no_ball() {
        val r = aggregateRuns(listOf(RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC)))
        assertEquals(1, r.total); assertEquals(0, r.batterRuns); assertEquals(1, r.bowlerRunsCharged); assertEquals(0, r.ranRuns)
        assertEquals(1, r.extras[ExtrasCategory.NO_BALLS])
    }

    @Test fun c18_no_ball_plus_two_off_bat() {
        val r = aggregateRuns(listOf(RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC), RunEvent(NO_BALL_BAT, 2, RUN)))
        assertEquals(3, r.total); assertEquals(2, r.batterRuns); assertEquals(3, r.bowlerRunsCharged); assertEquals(2, r.ranRuns)
        assertEquals(1, r.extras[ExtrasCategory.NO_BALLS])
    }

    @Test fun c19_no_ball_hit_for_four_is_five_total() {
        // "5" -- the no-ball penalty is never subsumed by the boundary (§7.6).
        val r = aggregateRuns(listOf(RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC), RunEvent(NO_BALL_BAT, 4, BOUNDARY)))
        assertEquals(5, r.total); assertEquals(4, r.batterRuns); assertEquals(5, r.bowlerRunsCharged); assertEquals(0, r.ranRuns)
    }

    @Test fun c21_no_ball_plus_two_byes() {
        val r = aggregateRuns(listOf(RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC), RunEvent(NO_BALL_BYE, 2, RUN)))
        assertEquals(3, r.total); assertEquals(0, r.batterRuns); assertEquals(1, r.bowlerRunsCharged); assertEquals(2, r.ranRuns)
        assertEquals(1, r.extras[ExtrasCategory.NO_BALLS]); assertEquals(2, r.extras[ExtrasCategory.BYES])
    }

    @Test fun c22_no_ball_plus_one_leg_bye() {
        val r = aggregateRuns(listOf(RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC), RunEvent(NO_BALL_LEG_BYE, 1, RUN)))
        assertEquals(2, r.total); assertEquals(0, r.batterRuns); assertEquals(1, r.bowlerRunsCharged); assertEquals(1, r.ranRuns)
        assertEquals(1, r.extras[ExtrasCategory.NO_BALLS]); assertEquals(1, r.extras[ExtrasCategory.LEG_BYES])
    }

    @Test fun penalty_awarded_to_bowling_side_is_still_a_penalty_extra() {
        val r = aggregateRuns(listOf(RunEvent(PENALTY, 5, AUTOMATIC, awardedToTeamId = "team-b")))
        assertEquals(5, r.total); assertEquals(0, r.batterRuns); assertEquals(0, r.bowlerRunsCharged)
        assertEquals(5, r.extras[ExtrasCategory.PENALTY])
    }
}
