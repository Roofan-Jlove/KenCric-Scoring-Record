package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.*
import com.kencric.scoring.core.model.RunEventOrigin.*
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * live-scoring.md §8's worked example, verified exactly, plus the
 * "taken from the end of the sequence" rule with multiple RUN-method
 * events -- both hand-checked against the spec text before being written
 * here, given zero compiler safety net in this environment.
 */
class ShortRunAdjusterTest {

    @Test fun no_short_runs_leaves_events_unchanged() {
        val events = listOf(RunEvent(OFF_BAT, 2, RUN))
        assertEquals(events, applyShortRuns(events, 0))
    }

    // §8's own worked example: (OFF_BAT, value=2, RUN) with shortRuns=1
    // credits 1, not 2, "across every downstream total".
    @Test fun spec_worked_example_two_run_one_short() {
        val adjusted = applyShortRuns(listOf(RunEvent(OFF_BAT, 2, RUN)), 1)
        val result = aggregateRuns(adjusted)
        assertEquals(1, result.batterRuns, "§8: effective credited value is 1, not 2")
        assertEquals(1, result.bowlerRunsCharged, "§8: the adjustment flows into bowlerRunsCharged too")
        assertEquals(1, result.ranRuns)
        assertEquals(1, result.total)
    }

    @Test fun deduction_taken_from_the_end_of_the_sequence() {
        // Two separate RUN-method events; shortRuns=1 should reduce only
        // the LAST one, per §8's "taken from the end" rule.
        val events = listOf(
            RunEvent(OFF_BAT, 1, RUN),
            RunEvent(BYE, 1, RUN),
        )
        val adjusted = applyShortRuns(events, 1)
        assertEquals(1, adjusted[0].value, "the earlier run keeps full credit")
        assertEquals(0, adjusted[1].value, "the later (short) run is voided")
    }

    @Test fun deduction_spans_multiple_events_from_the_end() {
        val events = listOf(
            RunEvent(OFF_BAT, 1, RUN),
            RunEvent(BYE, 1, RUN),
            RunEvent(LEG_BYE, 1, RUN),
        )
        val adjusted = applyShortRuns(events, 2)
        assertEquals(1, adjusted[0].value, "the first run is untouched")
        assertEquals(0, adjusted[1].value)
        assertEquals(0, adjusted[2].value)
    }

    @Test fun boundary_and_automatic_method_events_are_never_touched() {
        val events = listOf(
            RunEvent(OFF_BAT, 4, BOUNDARY),
            RunEvent(OFF_BAT, 1, RUN),
        )
        val adjusted = applyShortRuns(events, 1)
        assertEquals(4, adjusted[0].value, "BOUNDARY-method events are never subject to shortRuns")
        assertEquals(0, adjusted[1].value)
    }
}
