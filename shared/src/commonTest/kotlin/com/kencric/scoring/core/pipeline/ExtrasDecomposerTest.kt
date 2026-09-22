package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.*
import com.kencric.scoring.core.model.RunEventOrigin.*
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Verifies the constructed RunEvent shapes against the same §21.3/21.4
 * cases already hand-checked while building RunAggregator (TASK-0019) --
 * confirming the constructor and the aggregator agree on shape.
 */
class ExtrasDecomposerTest {

    @Test fun c13_plain_wide() {
        assertEquals(listOf(RunEvent(WIDE, 1, AUTOMATIC)), wideRunEvents())
    }

    @Test fun c14_wide_plus_two_run() {
        assertEquals(
            listOf(RunEvent(WIDE, 1, AUTOMATIC), RunEvent(WIDE, 2, RUN)),
            wideRunEvents(runsRun = 2),
        )
    }

    @Test fun c16_wide_to_boundary_is_one_event_not_two() {
        // "4 (not 5 -- §7.6)": exactly one RunEvent, boundary replaces
        // the automatic 1, not additive to it.
        val events = wideRunEvents(reachedBoundaryValue = 4)
        assertEquals(1, events.size)
        assertEquals(RunEvent(WIDE, 4, BOUNDARY), events[0])
    }

    @Test fun c19_no_ball_hit_for_four_is_always_two_events() {
        // Never subsumed, unlike the wide case -- always penalty + bat.
        assertEquals(
            listOf(
                RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC),
                RunEvent(NO_BALL_BAT, 4, BOUNDARY),
            ),
            noBallOffBatRunEvents(4, BOUNDARY),
        )
    }

    @Test fun c21_no_ball_plus_two_byes() {
        assertEquals(
            listOf(
                RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC),
                RunEvent(NO_BALL_BYE, 2, RUN),
            ),
            noBallByeRunEvents(2, RUN),
        )
    }

    @Test fun c22_no_ball_plus_one_leg_bye() {
        assertEquals(
            listOf(
                RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC),
                RunEvent(NO_BALL_LEG_BYE, 1, RUN),
            ),
            noBallLegByeRunEvents(1, RUN),
        )
    }

    @Test fun bye_and_leg_bye_on_a_legal_delivery_are_single_events() {
        assertEquals(RunEvent(BYE, 2, RUN), byeRunEvent(2, RUN))
        assertEquals(RunEvent(LEG_BYE, 1, RUN), legByeRunEvent(1, RUN))
    }

    @Test fun penalty_always_five_automatic() {
        val event = penaltyRunEvent("team-b")
        assertEquals(5, event.value)
        assertEquals(AUTOMATIC, event.method)
        assertEquals("team-b", event.awardedToTeamId)
    }
}
