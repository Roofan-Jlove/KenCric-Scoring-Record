import { describe, expect, it } from "vitest";
import {
  deriveViewState,
  hasActiveFilter,
  initialMatchSearchFilters,
  matchesSearch,
  sortMatches,
  type MatchSummary,
} from "./matchHistoryForm";

const riverside: MatchSummary = {
  id: "m1",
  teamAName: "Riverside CC",
  teamBName: "Harbour CC",
  competition: "Summer League",
  venue: "Riverside Ground",
  date: "2026-06-01",
  state: "FINAL",
};
const oakwood: MatchSummary = {
  id: "m2",
  teamAName: "Oakwood CC",
  teamBName: "Elmwood CC",
  competition: "Cup",
  venue: "Oakwood Park",
  date: "2026-07-15",
  state: "IN_PROGRESS",
};

describe("hasActiveFilter", () => {
  it("false with no filters set", () => {
    expect(hasActiveFilter(initialMatchSearchFilters())).toBe(false);
  });

  it("true when any dimension is set", () => {
    expect(hasActiveFilter({ ...initialMatchSearchFilters(), searchText: "riverside" })).toBe(true);
  });
});

describe("matchesSearch", () => {
  it("matches everything with no active filter", () => {
    expect(matchesSearch(riverside, initialMatchSearchFilters())).toBe(true);
  });

  it("matches free text against team, competition, and venue", () => {
    expect(matchesSearch(riverside, { ...initialMatchSearchFilters(), searchText: "summer" })).toBe(true);
    expect(matchesSearch(riverside, { ...initialMatchSearchFilters(), searchText: "harbour" })).toBe(true);
    expect(matchesSearch(riverside, { ...initialMatchSearchFilters(), searchText: "nonexistent" })).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(matchesSearch(riverside, { ...initialMatchSearchFilters(), searchText: "RIVERSIDE" })).toBe(true);
  });

  it("filters by date range", () => {
    expect(matchesSearch(riverside, { ...initialMatchSearchFilters(), dateRange: ["2026-01-01", "2026-05-31"] })).toBe(false);
    expect(matchesSearch(riverside, { ...initialMatchSearchFilters(), dateRange: ["2026-01-01", "2026-12-31"] })).toBe(true);
  });

  it("filters by state", () => {
    expect(matchesSearch(riverside, { ...initialMatchSearchFilters(), state: "IN_PROGRESS" })).toBe(false);
    expect(matchesSearch(riverside, { ...initialMatchSearchFilters(), state: "FINAL" })).toBe(true);
  });
});

describe("sortMatches", () => {
  it("newest first", () => {
    expect(sortMatches([riverside, oakwood], "NEWEST_FIRST").map((m) => m.id)).toEqual(["m2", "m1"]);
  });

  it("oldest first", () => {
    expect(sortMatches([riverside, oakwood], "OLDEST_FIRST").map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("does not mutate the input array", () => {
    const input = [riverside, oakwood];
    sortMatches(input, "NEWEST_FIRST");
    expect(input).toEqual([riverside, oakwood]);
  });
});

describe("deriveViewState -- distinguishing filtered-empty from unfiltered-empty", () => {
  it("LOADING while loading, regardless of counts", () => {
    expect(deriveViewState(true, 0, 0)).toBe("LOADING");
  });

  it("POPULATED when any match is visible", () => {
    expect(deriveViewState(false, 5, 2)).toBe("POPULATED");
  });

  it("UNFILTERED_EMPTY when there is genuinely no history at all", () => {
    expect(deriveViewState(false, 0, 0)).toBe("UNFILTERED_EMPTY");
  });

  it("FILTERED_EMPTY when matches exist but none pass the current filters", () => {
    expect(deriveViewState(false, 5, 0)).toBe("FILTERED_EMPTY");
  });
});
