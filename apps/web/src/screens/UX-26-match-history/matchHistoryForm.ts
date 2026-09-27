/**
 * TASK-0087: `ux-specification.md UX-26` -- Match History, search/
 * filter/sort layer.
 *
 * Confirmed no `shared/` pipeline logic exists for match search/listing
 * (checked) -- expected, since this is a backend-query-shaped screen
 * (search/filter/sort over a `matches` table), not a domain-pipeline
 * screen; every function here is net-new.
 *
 * CITATION NOTE: `FR-130` is clean (SRS-level, "Match search and
 * history," traces to discovery `FR-157`+`FR-158` consolidated).
 * `OFR-007` ("Access previously loaded squads, players, templates and
 * competition config while offline") is a real but loosely-fitting
 * citation for this screen's own offline-cached-search behavior --
 * general offline-cache access, not a precise per-match-history
 * citation, the same loose-fit shape `TASK-0083`'s `AUD-013` finding
 * already established.
 */

export type MatchState = "IN_PROGRESS" | "FINAL" | "ABANDONED";

export interface MatchSummary {
  id: string;
  teamAName: string;
  teamBName: string;
  competition: string | null;
  venue: string | null;
  date: string;
  state: MatchState;
}

export interface MatchSearchFilters {
  searchText: string;
  dateRange: readonly [string, string] | null;
  format: string | null;
  state: MatchState | null;
}

export function initialMatchSearchFilters(): MatchSearchFilters {
  return { searchText: "", dateRange: null, format: null, state: null };
}

/** `UX-26`'s own States: "Filtered (active-filter chips shown)" -- reused terminology from earlier filter screens (`TASK-0077`). */
export function hasActiveFilter(filters: MatchSearchFilters): boolean {
  return filters.searchText.trim() !== "" || filters.dateRange !== null || filters.format !== null || filters.state !== null;
}

/** `UX-26`'s own Inputs: "Search (team / competition / venue / date / player), filter chips (date range, format, state)." */
export function matchesSearch(match: MatchSummary, filters: MatchSearchFilters): boolean {
  const text = filters.searchText.trim().toLowerCase();
  if (text !== "") {
    const haystack = `${match.teamAName} ${match.teamBName} ${match.competition ?? ""} ${match.venue ?? ""}`.toLowerCase();
    if (!haystack.includes(text)) return false;
  }
  if (filters.dateRange !== null && (match.date < filters.dateRange[0] || match.date > filters.dateRange[1])) {
    return false;
  }
  if (filters.state !== null && match.state !== filters.state) return false;
  return true;
}

export type SortOrder = "NEWEST_FIRST" | "OLDEST_FIRST";

export function sortMatches(matches: readonly MatchSummary[], order: SortOrder): MatchSummary[] {
  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  return order === "NEWEST_FIRST" ? sorted.reverse() : sorted;
}

export type MatchHistoryViewState = "LOADING" | "POPULATED" | "FILTERED_EMPTY" | "UNFILTERED_EMPTY";

/**
 * `UX-26`'s own States: distinguishes "Filtered-empty (no matches for
 * current filters)" from "Unfiltered-empty (genuinely no history)" --
 * each needs its own explicit copy, never a blank confusing screen.
 */
export function deriveViewState(isLoading: boolean, totalMatchCount: number, visibleMatchCount: number): MatchHistoryViewState {
  if (isLoading) return "LOADING";
  if (visibleMatchCount > 0) return "POPULATED";
  return totalMatchCount === 0 ? "UNFILTERED_EMPTY" : "FILTERED_EMPTY";
}
