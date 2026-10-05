import { describe, expect, it } from "vitest";
import { mapClaimMatchUpdateRow } from "../src/commands/claimMatchPersistence.js";
import type { MatchRow } from "../src/commands/matches.js";

// Only mapClaimMatchUpdateRow is pure and unit-tested here --
// claimMatchReal/persistClaimMatchUpdate are real async Supabase IO,
// left untested, the same precedent this codebase already set
// repeatedly this session.

describe("mapClaimMatchUpdateRow (TASK-0154)", () => {
  it("maps claimStatus/organizationId/rowVersion/updatedAt/updatedBy -- a different partial-update shape than disputeMatch's own", () => {
    const row: MatchRow = {
      id: "match-1", organizationId: "org-1", originDeviceId: "device-1", claimStatus: "CLAIMED",
      homeTeamId: "team-A", awayTeamId: "team-B", homeXi: null, awayXi: null, format: "T20",
      oversAllotted: null, conditionsProfile: null, conditionsProfileVersion: null, dlsTableVersion: null,
      rainMethod: "NONE", tossWinnerTeamId: null, tossDecision: null, venue: null, scheduledStart: null,
      matchTimezone: "Asia/Karachi", minOversForResult: null, state: "SCHEDULED", result: null, rowVersion: 2,
      createdAt: "now", createdBy: "device-1", updatedAt: "later", updatedBy: "user-1",
    };

    expect(mapClaimMatchUpdateRow(row)).toEqual({ claim_status: "CLAIMED", organization_id: "org-1", row_version: 2, updated_at: "later", updated_by: "user-1" });
  });

  it("maps a personal (non-org) claim with organizationId null", () => {
    const row: MatchRow = {
      id: "match-1", organizationId: null, originDeviceId: "device-1", claimStatus: "CLAIMED",
      homeTeamId: "team-A", awayTeamId: "team-B", homeXi: null, awayXi: null, format: "T20",
      oversAllotted: null, conditionsProfile: null, conditionsProfileVersion: null, dlsTableVersion: null,
      rainMethod: "NONE", tossWinnerTeamId: null, tossDecision: null, venue: null, scheduledStart: null,
      matchTimezone: "Asia/Karachi", minOversForResult: null, state: "SCHEDULED", result: null, rowVersion: 2,
      createdAt: "now", createdBy: "device-1", updatedAt: "later", updatedBy: "user-1",
    };

    expect(mapClaimMatchUpdateRow(row).organization_id).toBeNull();
  });
});
