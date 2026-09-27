import { useState } from "react";
import {
  deriveViewState,
  hasActiveFilter,
  initialMatchSearchFilters,
  matchesSearch,
  sortMatches,
  type MatchSummary,
  type SortOrder,
} from "./matchHistoryForm";

/**
 * TASK-0087: `ux-specification.md UX-26` -- Match History. Styling not
 * applied, same scope boundary as every earlier screen this session.
 * `onOpenMatch` routes to `UX-20` (final) or `UX-10` (in-progress) per
 * this screen's own Actions text -- the routing decision itself belongs
 * to the caller/navigation layer, not this screen's own logic.
 */

export interface MatchHistoryScreenProps {
  matches: readonly MatchSummary[];
  isLoading: boolean;
  isOffline: boolean;
  onOpenMatch: (matchId: string, state: MatchSummary["state"]) => void;
  onCreateMatch: () => void;
}

export function MatchHistoryScreen({ matches, isLoading, isOffline, onOpenMatch, onCreateMatch }: MatchHistoryScreenProps) {
  const [filters, setFilters] = useState(initialMatchSearchFilters);
  const [sortOrder, setSortOrder] = useState<SortOrder>("NEWEST_FIRST");

  const visible = sortMatches(matches.filter((m) => matchesSearch(m, filters)), sortOrder);
  const viewState = deriveViewState(isLoading, matches.length, visible.length);

  function handleClearFilters() {
    setFilters(initialMatchSearchFilters());
  }

  if (viewState === "LOADING") {
    return <p role="status">Loading…</p>;
  }

  if (viewState === "UNFILTERED_EMPTY") {
    return (
      <div>
        <p>This is where your completed matches will appear.</p>
        <button type="button" onClick={onCreateMatch}>
          Create Match
        </button>
      </div>
    );
  }

  return (
    <div>
      {isOffline && <p role="status">Offline — results may be incomplete</p>}

      <label htmlFor="match-search">Search matches</label>
      <input id="match-search" value={filters.searchText} onChange={(event) => setFilters((f) => ({ ...f, searchText: event.target.value }))} />
      <p aria-live="polite">{visible.length} matches found</p>

      <button type="button" aria-pressed={filters.state === "IN_PROGRESS"} onClick={() => setFilters((f) => ({ ...f, state: f.state === "IN_PROGRESS" ? null : "IN_PROGRESS" }))}>
        In progress
      </button>
      <button type="button" aria-pressed={filters.state === "FINAL"} onClick={() => setFilters((f) => ({ ...f, state: f.state === "FINAL" ? null : "FINAL" }))}>
        Final
      </button>

      {hasActiveFilter(filters) && (
        <button type="button" onClick={handleClearFilters}>
          Clear filters
        </button>
      )}

      <label htmlFor="sort-order">Sort</label>
      <select id="sort-order" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
        <option value="NEWEST_FIRST">Newest first</option>
        <option value="OLDEST_FIRST">Oldest first</option>
      </select>

      {viewState === "FILTERED_EMPTY" ? (
        <div>
          <p>No matches for the current filters</p>
        </div>
      ) : (
        <ul aria-label="Matches">
          {visible.map((match) => (
            <li key={match.id}>
              <button type="button" onClick={() => onOpenMatch(match.id, match.state)}>
                {match.teamAName} vs {match.teamBName} — {match.date}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
