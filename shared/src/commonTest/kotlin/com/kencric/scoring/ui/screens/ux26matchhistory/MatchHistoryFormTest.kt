package com.kencric.scoring.ui.screens.ux26matchhistory

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * `TASK-0088`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-26-match-history/matchHistoryForm.test.ts`
 * (`TASK-0087`) input-for-input.
 */
class MatchHistoryFormTest {

    private val riverside = MatchSummary(
        id = "m1", teamAName = "Riverside CC", teamBName = "Harbour CC",
        competition = "Summer League", venue = "Riverside Ground", date = "2026-06-01", state = MatchState.FINAL,
    )
    private val oakwood = MatchSummary(
        id = "m2", teamAName = "Oakwood CC", teamBName = "Elmwood CC",
        competition = "Cup", venue = "Oakwood Park", date = "2026-07-15", state = MatchState.IN_PROGRESS,
    )

    @Test fun hasActiveFilter_false_with_no_filters_set() {
        assertFalse(hasActiveFilter(initialMatchSearchFilters()))
    }

    @Test fun hasActiveFilter_true_when_any_dimension_is_set() {
        assertTrue(hasActiveFilter(initialMatchSearchFilters().copy(searchText = "riverside")))
    }

    @Test fun matchesSearch_matches_everything_with_no_active_filter() {
        assertTrue(matchesSearch(riverside, initialMatchSearchFilters()))
    }

    @Test fun matchesSearch_matches_free_text_against_team_competition_and_venue() {
        assertTrue(matchesSearch(riverside, initialMatchSearchFilters().copy(searchText = "summer")))
        assertTrue(matchesSearch(riverside, initialMatchSearchFilters().copy(searchText = "harbour")))
        assertFalse(matchesSearch(riverside, initialMatchSearchFilters().copy(searchText = "nonexistent")))
    }

    @Test fun matchesSearch_is_case_insensitive() {
        assertTrue(matchesSearch(riverside, initialMatchSearchFilters().copy(searchText = "RIVERSIDE")))
    }

    @Test fun matchesSearch_filters_by_date_range() {
        assertFalse(matchesSearch(riverside, initialMatchSearchFilters().copy(dateRange = "2026-01-01" to "2026-05-31")))
        assertTrue(matchesSearch(riverside, initialMatchSearchFilters().copy(dateRange = "2026-01-01" to "2026-12-31")))
    }

    @Test fun matchesSearch_filters_by_state() {
        assertFalse(matchesSearch(riverside, initialMatchSearchFilters().copy(state = MatchState.IN_PROGRESS)))
        assertTrue(matchesSearch(riverside, initialMatchSearchFilters().copy(state = MatchState.FINAL)))
    }

    @Test fun sortMatches_newest_first() {
        assertEquals(listOf("m2", "m1"), sortMatches(listOf(riverside, oakwood), SortOrder.NEWEST_FIRST).map { it.id })
    }

    @Test fun sortMatches_oldest_first() {
        assertEquals(listOf("m1", "m2"), sortMatches(listOf(riverside, oakwood), SortOrder.OLDEST_FIRST).map { it.id })
    }

    @Test fun deriveViewState_loading_while_loading_regardless_of_counts() {
        assertEquals(MatchHistoryViewState.LOADING, deriveViewState(true, 0, 0))
    }

    @Test fun deriveViewState_populated_when_any_match_is_visible() {
        assertEquals(MatchHistoryViewState.POPULATED, deriveViewState(false, 5, 2))
    }

    @Test fun deriveViewState_unfiltered_empty_when_there_is_genuinely_no_history_at_all() {
        assertEquals(MatchHistoryViewState.UNFILTERED_EMPTY, deriveViewState(false, 0, 0))
    }

    @Test fun deriveViewState_filtered_empty_when_matches_exist_but_none_pass_the_current_filters() {
        assertEquals(MatchHistoryViewState.FILTERED_EMPTY, deriveViewState(false, 5, 0))
    }
}
