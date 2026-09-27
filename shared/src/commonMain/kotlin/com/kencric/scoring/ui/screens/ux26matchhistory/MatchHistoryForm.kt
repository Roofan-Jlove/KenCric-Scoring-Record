package com.kencric.scoring.ui.screens.ux26matchhistory

/**
 * TASK-0088: `ux-specification.md UX-26`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-26-match-history/
 * matchHistoryForm.ts` (`TASK-0087`) -- same contract-only scope note
 * as every earlier screen this session: no Android SDK/Gradle/Kotlin
 * toolchain exists, placed in `shared/commonMain` since this logic
 * touches no Android API surface at all.
 *
 * See `TASK-0087`'s own file for the full grounding (clean `FR-130`
 * citation; `OFR-007`'s loose fit; confirmed absence of any reusable
 * `shared/` pipeline logic for this backend-query-shaped screen).
 */

enum class MatchState { IN_PROGRESS, FINAL, ABANDONED }

data class MatchSummary(
    val id: String,
    val teamAName: String,
    val teamBName: String,
    val competition: String?,
    val venue: String?,
    val date: String,
    val state: MatchState,
)

data class MatchSearchFilters(
    val searchText: String = "",
    val dateRange: Pair<String, String>? = null,
    val format: String? = null,
    val state: MatchState? = null,
)

fun initialMatchSearchFilters(): MatchSearchFilters = MatchSearchFilters()

fun hasActiveFilter(filters: MatchSearchFilters): Boolean =
    filters.searchText.trim().isNotEmpty() || filters.dateRange != null || filters.format != null || filters.state != null

/** UX-26's own Inputs: "Search (team / competition / venue / date / player), filter chips (date range, format, state)." */
fun matchesSearch(match: MatchSummary, filters: MatchSearchFilters): Boolean {
    val text = filters.searchText.trim().lowercase()
    if (text.isNotEmpty()) {
        val haystack = "${match.teamAName} ${match.teamBName} ${match.competition ?: ""} ${match.venue ?: ""}".lowercase()
        if (!haystack.contains(text)) return false
    }
    val dateRange = filters.dateRange
    if (dateRange != null && (match.date < dateRange.first || match.date > dateRange.second)) return false
    if (filters.state != null && match.state != filters.state) return false
    return true
}

enum class SortOrder { NEWEST_FIRST, OLDEST_FIRST }

fun sortMatches(matches: List<MatchSummary>, order: SortOrder): List<MatchSummary> {
    val sorted = matches.sortedBy { it.date }
    return if (order == SortOrder.NEWEST_FIRST) sorted.reversed() else sorted
}

enum class MatchHistoryViewState { LOADING, POPULATED, FILTERED_EMPTY, UNFILTERED_EMPTY }

/** UX-26's own States: distinguishes filtered-empty from unfiltered-empty. */
fun deriveViewState(isLoading: Boolean, totalMatchCount: Int, visibleMatchCount: Int): MatchHistoryViewState {
    if (isLoading) return MatchHistoryViewState.LOADING
    if (visibleMatchCount > 0) return MatchHistoryViewState.POPULATED
    return if (totalMatchCount == 0) MatchHistoryViewState.UNFILTERED_EMPTY else MatchHistoryViewState.FILTERED_EMPTY
}
