package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.RUN
import com.kencric.scoring.core.model.RunEventOrigin.OFF_BAT
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertEquals

class WicketRunResolverTest {

    // live-scoring.md §22.8 EX-09: RUN_OUT after one completed run ->
    // total=1, ranRuns=1, credited in full via the normal aggregation --
    // no special wicket-resolution logic needed, confirmed by using the
    // *actual* TASK-0019 aggregator, not a hand-constructed value.
    @Test fun ex09_run_out_preserves_the_normal_aggregation_untouched() {
        val aggregate = aggregateRuns(listOf(RunEvent(OFF_BAT, 1, RUN)))
        assertEquals(1, aggregate.total)
        assertEquals(1, aggregate.ranRuns)
        // Must not throw -- RUN_OUT is a may-carry-runs mode.
        assertWicketRunInvariant(DismissalMode.RUN_OUT, aggregate)
    }

    @Test fun always_zero_runs_mode_with_zero_total_passes() {
        val aggregate = aggregateRuns(emptyList())
        assertWicketRunInvariant(DismissalMode.CAUGHT, aggregate)
    }

    // If this ever throws in real use, it means V6 was bypassed
    // somewhere upstream -- this test exists to document that failure
    // mode explicitly, not because it's expected to happen via the
    // normal validated pipeline.
    @Test fun always_zero_runs_mode_with_nonzero_total_throws() {
        val aggregate = aggregateRuns(listOf(RunEvent(OFF_BAT, 2, RUN)))
        assertFailsWith<IllegalStateException> {
            assertWicketRunInvariant(DismissalMode.CAUGHT, aggregate)
        }
    }
}
