import { describe, expect, it } from "vitest";
import { mapMembershipRowFromDb, mapMembershipRowToUpdateRow } from "../src/commands/deactivateMemberPersistence.js";
import type { MembershipRow } from "../src/commands/memberships.js";

// Only the pure mapping functions are tested here --
// deactivateMemberReal/hydrateMembership/persistMembershipUpdate are
// real async Supabase IO, left untested, the same precedent this
// codebase already set repeatedly this session.

describe("mapMembershipRowFromDb / mapMembershipRowToUpdateRow (TASK-0153)", () => {
  it("maps snake_case DB columns to camelCase fields", () => {
    const row = mapMembershipRowFromDb({
      id: "membership-1", user_id: "user-1", organization_id: "org-1", roles: ["HEAD_SCORER"], status: "ACTIVE",
      invited_at: null, accepted_at: null, row_version: 1,
      created_at: "2026-10-01T00:00:00Z", created_by: "admin-1", updated_at: "2026-10-02T00:00:00Z", updated_by: "admin-2",
    });

    expect(row).toEqual({
      id: "membership-1", userId: "user-1", organizationId: "org-1", roles: ["HEAD_SCORER"], status: "ACTIVE",
      invitedAt: null, acceptedAt: null, rowVersion: 1,
      createdAt: "2026-10-01T00:00:00Z", createdBy: "admin-1", updatedAt: "2026-10-02T00:00:00Z", updatedBy: "admin-2",
    });
  });

  it("maps only the three mutable fields for an update", () => {
    const row: MembershipRow = {
      id: "membership-1", userId: "user-1", organizationId: "org-1", roles: ["HEAD_SCORER"], status: "DEACTIVATED",
      rowVersion: 2, createdAt: "now", createdBy: "admin-1", updatedAt: "later", updatedBy: "admin-2",
    };

    expect(mapMembershipRowToUpdateRow(row)).toEqual({ status: "DEACTIVATED", row_version: 2, updated_at: "later", updated_by: "admin-2" });
  });
});
