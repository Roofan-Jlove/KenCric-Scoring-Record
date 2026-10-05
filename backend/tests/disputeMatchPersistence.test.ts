import { describe, expect, it } from "vitest";
import {
  mapDisputeRowFromDb,
  mapDisputeRowToInsertRow,
  mapDisputeRowToUpdateRow,
  mapMatchRowToUpdateRow,
} from "../src/commands/disputeMatchPersistence.js";
import type { DisputeRow } from "../src/commands/disputeMatch.js";
import type { MatchRow } from "../src/commands/matches.js";

// Only pure mapping functions are tested here -- `HydratedAuditLogStore`
// moved to `auditLogPersistence.test.ts` alongside its own module
// (TASK-0152). lockMatchForDisputeReal/adjudicateDisputeReal/
// hydrateMatch/persistMatchUpdate/isOrganizationAdminForMatch are real
// async Supabase IO, left untested, the same precedent this codebase
// already set (roleContext.ts/session.ts/syncEventsPersistence.ts/
// signOffMatchPersistence.ts/exportJobsPersistence.ts).

describe("mapMatchRowToUpdateRow (TASK-0151)", () => {
  it("maps only the four mutable fields for an update, leaving the rest of the row untouched at the DB level", () => {
    const row: MatchRow = {
      id: "match-1", organizationId: null, originDeviceId: "device-1", claimStatus: "CLAIMED",
      homeTeamId: "team-A", awayTeamId: "team-B", homeXi: null, awayXi: null, format: "T20",
      oversAllotted: 20, conditionsProfile: null, conditionsProfileVersion: null, dlsTableVersion: null,
      rainMethod: "NONE", tossWinnerTeamId: null, tossDecision: null, venue: null, scheduledStart: null,
      matchTimezone: "Asia/Karachi", minOversForResult: null, state: "DISPUTED", result: null, rowVersion: 2,
      createdAt: "now", createdBy: "user-1", updatedAt: "later", updatedBy: "user-2",
    };

    expect(mapMatchRowToUpdateRow(row)).toEqual({ state: "DISPUTED", row_version: 2, updated_at: "later", updated_by: "user-2" });
  });
});

describe("mapDisputeRowFromDb / mapDisputeRowToInsertRow / mapDisputeRowToUpdateRow (TASK-0151)", () => {
  const disputeRow: DisputeRow = {
    id: "dispute-1", matchId: "match-1", status: "OPEN", reason: "scoring disagreement", lockedFromState: "IN_PROGRESS",
    lockedBy: "admin-1", lockedAt: "2026-10-05T00:00:00Z", ruling: null, resultingCorrections: null,
    adjudicatedBy: null, adjudicatedAt: null, rowVersion: 1,
  };

  it("maps a DB row into a DisputeRow", () => {
    const row = mapDisputeRowFromDb({
      id: "dispute-1", match_id: "match-1", status: "OPEN", reason: "x", locked_from_state: "IN_PROGRESS",
      locked_by: "admin-1", locked_at: "now", ruling: null, resulting_corrections: null,
      adjudicated_by: null, adjudicated_at: null, row_version: 1,
    });
    expect(row.matchId).toBe("match-1");
    expect(row.status).toBe("OPEN");
  });

  it("maps a DisputeRow to a full insert row", () => {
    expect(mapDisputeRowToInsertRow(disputeRow)).toMatchObject({ id: "dispute-1", match_id: "match-1", status: "OPEN", reason: "scoring disagreement" });
  });

  it("maps an adjudicated DisputeRow to its update row, carrying resultingCorrections through", () => {
    const adjudicated: DisputeRow = { ...disputeRow, status: "ADJUDICATED", ruling: "Upheld", resultingCorrections: ["event-1"], adjudicatedBy: "admin-2", adjudicatedAt: "later", rowVersion: 2 };
    expect(mapDisputeRowToUpdateRow(adjudicated)).toEqual({
      status: "ADJUDICATED", ruling: "Upheld", resulting_corrections: ["event-1"], adjudicated_by: "admin-2", adjudicated_at: "later", row_version: 2,
    });
  });
});
