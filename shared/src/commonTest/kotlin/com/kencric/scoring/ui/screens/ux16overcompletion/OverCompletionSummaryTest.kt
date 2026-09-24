package com.kencric.scoring.ui.screens.ux16overcompletion

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0068`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-16-over-completion/
 * overCompletionSummary.test.ts` (`TASK-0067`) input-for-input.
 */
class OverCompletionSummaryTest {

    @Test fun formatOvers_formats_completed_overs_plus_balls_into_the_current_over() {
        assertEquals("3.2", formatOvers(20, 6))
    }

    @Test fun formatOvers_formats_a_completed_over_boundary_with_zero_balls_into_the_next_over() {
        assertEquals("3.0", formatOvers(18, 6))
    }

    @Test fun formatBowlerFigures_formats_a_full_figures_line_with_correct_pluralization() {
        val figures = BowlerFigures(legalBallsBowled = 20, runsCharged = 18, wickets = 1, maidens = 0)
        assertEquals("3.2 overs, 0 maidens, 18 runs, 1 wicket", formatBowlerFigures(figures, 6))
    }

    @Test fun formatBowlerFigures_singularizes_exactly_one_values_correctly() {
        val figures = BowlerFigures(legalBallsBowled = 6, runsCharged = 1, wickets = 1, maidens = 1)
        assertEquals("1.0 overs, 1 maiden, 1 run, 1 wicket", formatBowlerFigures(figures, 6))
    }

    @Test fun formatBowlerFigures_formats_a_maiden_over_with_zero_runs_charged() {
        val figures = BowlerFigures(legalBallsBowled = 6, runsCharged = 0, wickets = 0, maidens = 1)
        assertEquals("1.0 overs, 1 maiden, 0 runs, 0 wickets", formatBowlerFigures(figures, 6))
    }
}
