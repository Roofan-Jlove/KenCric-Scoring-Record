package com.kencric.scoring.ui.screens.ux21ballbyball

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0078`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-21-ball-by-ball/ballByBallForm.test.ts`
 * (`TASK-0077`) input-for-input.
 */
class BallByBallFormTest {

    private fun baseInput(
        runs: Int = 0,
        isBoundary: Boolean = false,
        wicketDescription: String? = null,
        extraDescription: String? = null,
    ) = DeliverySummaryInput(
        overNumber = 12,
        ballInOver = 4,
        bowlerName = "Smith",
        strikerName = "Jones",
        runs = runs,
        isBoundary = isBoundary,
        wicketDescription = wicketDescription,
        extraDescription = extraDescription,
    )

    @Test fun formatDeliveryOverBall_formats_exactly() {
        assertEquals("12.4", formatDeliveryOverBall(12, 4))
    }

    @Test fun summarizeDelivery_summarises_a_boundary_delivery() {
        assertEquals("Over 12.4: Smith to Jones, 4 runs, boundary", summarizeDelivery(baseInput(runs = 4, isBoundary = true)))
    }

    @Test fun summarizeDelivery_summarises_a_dot_ball() {
        assertEquals("Over 12.4: Smith to Jones, dot ball", summarizeDelivery(baseInput(runs = 0)))
    }

    @Test fun summarizeDelivery_summarises_a_single_run_without_the_boundary_qualifier() {
        assertEquals("Over 12.4: Smith to Jones, 1 run", summarizeDelivery(baseInput(runs = 1)))
    }

    @Test fun summarizeDelivery_summarises_a_wicket_taking_priority_over_runs() {
        assertEquals("Over 12.4: Smith to Jones, bowled", summarizeDelivery(baseInput(wicketDescription = "bowled")))
    }

    @Test fun summarizeDelivery_summarises_an_extra_when_no_wicket_is_present() {
        assertEquals("Over 12.4: Smith to Jones, wide", summarizeDelivery(baseInput(extraDescription = "wide")))
    }

    @Test fun summarizeDelivery_a_wicket_takes_priority_over_an_extra_if_both_present() {
        assertEquals(
            "Over 12.4: Smith to Jones, run out",
            summarizeDelivery(baseInput(wicketDescription = "run out", extraDescription = "wide")),
        )
    }

    private val delivery = FilterableDelivery(overNumber = 12, bowlerId = "b1", strikerId = "s1", phase = "MIDDLE")

    @Test fun matchesFilter_matches_everything_with_no_active_filter() {
        assertTrue(matchesFilter(delivery, initialDeliveryFilter()))
        assertFalse(hasActiveFilter(initialDeliveryFilter()))
    }

    @Test fun matchesFilter_filters_by_over_range() {
        assertFalse(matchesFilter(delivery, initialDeliveryFilter().copy(overRange = 1 to 10)))
        assertTrue(matchesFilter(delivery, initialDeliveryFilter().copy(overRange = 10 to 15)))
    }

    @Test fun matchesFilter_filters_by_bowler() {
        assertFalse(matchesFilter(delivery, initialDeliveryFilter().copy(bowlerId = "b2")))
        assertTrue(matchesFilter(delivery, initialDeliveryFilter().copy(bowlerId = "b1")))
    }

    @Test fun matchesFilter_filters_by_batter() {
        assertFalse(matchesFilter(delivery, initialDeliveryFilter().copy(batterId = "s2")))
    }

    @Test fun matchesFilter_filters_by_phase() {
        assertFalse(matchesFilter(delivery, initialDeliveryFilter().copy(phase = "POWERPLAY")))
    }

    @Test fun hasActiveFilter_is_true_when_any_dimension_is_set() {
        assertTrue(hasActiveFilter(initialDeliveryFilter().copy(bowlerId = "b1")))
    }

    @Test fun parseOverBallQuery_parses_a_valid_query() {
        assertEquals(OverBallQuery(12, 4), parseOverBallQuery("12.4"))
    }

    @Test fun parseOverBallQuery_trims_surrounding_whitespace() {
        assertEquals(OverBallQuery(3, 2), parseOverBallQuery("  3.2  "))
    }

    @Test fun parseOverBallQuery_rejects_a_malformed_query() {
        assertNull(parseOverBallQuery("not a query"))
        assertNull(parseOverBallQuery("12"))
        assertNull(parseOverBallQuery("12."))
    }

    @Test fun shouldAutoScrollToNewest_auto_scrolls_when_the_user_has_not_scrolled_up() {
        assertTrue(shouldAutoScrollToNewest(false))
    }

    @Test fun shouldAutoScrollToNewest_does_not_auto_scroll_once_the_user_has_scrolled_up() {
        assertFalse(shouldAutoScrollToNewest(true))
    }
}
