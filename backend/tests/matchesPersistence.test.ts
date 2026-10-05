import { describe, expect, it } from "vitest";
import { mapMatchRowFromDb } from "../src/commands/matchesPersistence.js";

// Only mapMatchRowFromDb is pure and unit-tested here -- hydrateMatch
// is real async Supabase IO, left untested, the same precedent this
// codebase already set repeatedly this session.

describe("mapMatchRowFromDb (TASK-0154, moved from TASK-0151)", () => {
  it("maps snake_case DB columns to camelCase fields", () => {
    const row = mapMatchRowFromDb({
      id: "match-1", organization_id: "org-1", origin_device_id: "device-1", claim_status: "CLAIMED",
      home_team_id: "team-A", away_team_id: "team-B", home_xi: null, away_xi: null, format: "T20",
      overs_allotted: 20, conditions_profile: {}, conditions_profile_version: 1, dls_table_version: null,
      rain_method: "NONE", toss_winner_team_id: null, toss_decision: null, venue: null, scheduled_start: null,
      match_timezone: "Asia/Karachi", min_overs_for_result: null, state: "IN_PROGRESS", row_version: 3,
      created_at: "2026-10-01T00:00:00Z", created_by: "user-1", updated_at: "2026-10-02T00:00:00Z", updated_by: "user-2",
    });

    expect(row.id).toBe("match-1");
    expect(row.state).toBe("IN_PROGRESS");
    expect(row.rowVersion).toBe(3);
    expect(row.homeTeamId).toBe("team-A");
  });

  it("maps a GUEST, org-less match correctly (organizationId null)", () => {
    const row = mapMatchRowFromDb({
      id: "match-1", organization_id: null, origin_device_id: "device-1", claim_status: "GUEST",
      home_team_id: "team-A", away_team_id: "team-B", home_xi: null, away_xi: null, format: "T20",
      overs_allotted: null, conditions_profile: {}, conditions_profile_version: 1, dls_table_version: null,
      rain_method: "NONE", toss_winner_team_id: null, toss_decision: null, venue: null, scheduled_start: null,
      match_timezone: "Asia/Karachi", min_overs_for_result: null, state: "SCHEDULED", row_version: 1,
      created_at: "now", created_by: "device-placeholder", updated_at: "now", updated_by: "device-placeholder",
    });

    expect(row.organizationId).toBeNull();
    expect(row.claimStatus).toBe("GUEST");
  });
});
