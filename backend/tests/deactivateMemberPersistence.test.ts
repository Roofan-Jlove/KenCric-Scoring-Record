import { describe, expect, it } from "vitest";
import { mapMembershipRowToUpdateRow } from "../src/commands/deactivateMemberPersistence.js";
import type { MembershipRow } from "../src/commands/memberships.js";

// Only mapMembershipRowToUpdateRow is tested here --
// mapMembershipRowFromDb moved to membershipsPersistence.test.ts
// alongside its own module (TASK-0155). deactivateMemberReal/
// hydrateMembership/persistMembershipUpdate are real async Supabase
// IO, left untested, the same precedent this codebase already set
// repeatedly this session.

describe("mapMembershipRowToUpdateRow (TASK-0153)", () => {
  it("maps only the three mutable fields for an update", () => {
    const row: MembershipRow = {
      id: "membership-1", userId: "user-1", organizationId: "org-1", roles: ["HEAD_SCORER"], status: "DEACTIVATED",
      rowVersion: 2, createdAt: "now", createdBy: "admin-1", updatedAt: "later", updatedBy: "admin-2",
    };

    expect(mapMembershipRowToUpdateRow(row)).toEqual({ status: "DEACTIVATED", row_version: 2, updated_at: "later", updated_by: "admin-2" });
  });
});
