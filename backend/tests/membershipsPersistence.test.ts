import { describe, expect, it } from "vitest";
import { mapMembershipRowFromDb } from "../src/commands/membershipsPersistence.js";

// Only mapMembershipRowFromDb is pure and unit-tested here --
// hydrateMembership is real async Supabase IO, left untested, the
// same precedent this codebase already set repeatedly this session.

describe("mapMembershipRowFromDb (TASK-0155, moved from TASK-0153)", () => {
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

  it("maps a PENDING-invite-originated membership with invitedAt set, acceptedAt set at acceptance time", () => {
    const row = mapMembershipRowFromDb({
      id: "membership-1", user_id: "user-1", organization_id: "org-1", roles: ["ASSISTANT_SCORER"], status: "ACTIVE",
      invited_at: "2026-10-01T00:00:00Z", accepted_at: "2026-10-02T00:00:00Z", row_version: 1,
      created_at: "2026-10-02T00:00:00Z", created_by: "admin-1", updated_at: "2026-10-02T00:00:00Z", updated_by: "admin-1",
    });

    expect(row.invitedAt).toBe("2026-10-01T00:00:00Z");
    expect(row.acceptedAt).toBe("2026-10-02T00:00:00Z");
  });
});
