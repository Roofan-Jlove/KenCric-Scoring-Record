import { describe, expect, it } from "vitest";
import { mapDivergenceRowFromDb, mapDivergenceRowToUpdateRow } from "../src/commands/divergenceResolutionPersistence.js";
import type { DivergenceRecord } from "../src/sync/divergenceDetector.js";

// Only the pure mapping functions are tested here --
// isAuthorizedScorerOnMatch/proposeDivergenceResolutionReal/
// confirmDivergenceResolutionReal/hydrateDivergence/
// persistDivergenceUpdate are real async Supabase IO, left untested,
// the same precedent this codebase already set repeatedly this
// session.

describe("mapDivergenceRowFromDb (TASK-0156)", () => {
  it("maps snake_case DB columns to camelCase fields for an OPEN divergence", () => {
    const row = mapDivergenceRowFromDb({
      id: "divergence-1", match_id: "match-1", over_ball: "12.3", field: "runs",
      stream_a_id: "stream-A", stream_b_id: "stream-B", value_a: 1, value_b: 4,
      status: "OPEN", proposed_value: null, proposed_by: null, confirmed_by: null, resolved_event_id: null,
    });

    expect(row).toEqual({
      id: "divergence-1", matchId: "match-1", overBall: "12.3", field: "runs",
      streamAId: "stream-A", streamBId: "stream-B", valueA: 1, valueB: 4,
      status: "OPEN", proposedValue: null, proposedBy: undefined, confirmedBy: undefined, resolvedEventId: undefined,
    });
  });

  it("maps a RESOLVED divergence with every optional field set", () => {
    const row = mapDivergenceRowFromDb({
      id: "divergence-1", match_id: "match-1", over_ball: "12.3", field: "runs",
      stream_a_id: "stream-A", stream_b_id: "stream-B", value_a: 1, value_b: 4,
      status: "RESOLVED", proposed_value: 4, proposed_by: "scorer-1", confirmed_by: "scorer-2", resolved_event_id: "event-1",
    });

    expect(row.proposedBy).toBe("scorer-1");
    expect(row.confirmedBy).toBe("scorer-2");
    expect(row.resolvedEventId).toBe("event-1");
  });
});

describe("mapDivergenceRowToUpdateRow (TASK-0156)", () => {
  it("maps a PROPOSED row's update, nulling the still-unset confirm-side fields", () => {
    const row: DivergenceRecord = {
      id: "divergence-1", matchId: "match-1", overBall: "12.3", field: "runs", streamAId: "stream-A", streamBId: "stream-B",
      valueA: 1, valueB: 4, status: "PROPOSED", proposedValue: 4, proposedBy: "scorer-1",
    };

    expect(mapDivergenceRowToUpdateRow(row)).toEqual({
      status: "PROPOSED", proposed_value: 4, proposed_by: "scorer-1", confirmed_by: null, resolved_event_id: null,
    });
  });

  it("maps a RESOLVED row's update, carrying the already-set propose-side fields through unchanged", () => {
    const row: DivergenceRecord = {
      id: "divergence-1", matchId: "match-1", overBall: "12.3", field: "runs", streamAId: "stream-A", streamBId: "stream-B",
      valueA: 1, valueB: 4, status: "RESOLVED", proposedValue: 4, proposedBy: "scorer-1", confirmedBy: "scorer-2", resolvedEventId: "event-1",
    };

    expect(mapDivergenceRowToUpdateRow(row)).toEqual({
      status: "RESOLVED", proposed_value: 4, proposed_by: "scorer-1", confirmed_by: "scorer-2", resolved_event_id: "event-1",
    });
  });
});
