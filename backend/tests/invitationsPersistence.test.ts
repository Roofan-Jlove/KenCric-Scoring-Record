import { describe, expect, it } from "vitest";
import {
  emailMatchesInvitation,
  mapInvitationRowFromDb,
  mapInvitationRowToInsertRow,
  mapInvitationRowToUpdateRow,
  mapMembershipRowToInsertRow,
} from "../src/commands/invitationsPersistence.js";
import type { InvitationRow } from "../src/commands/invitations.js";
import type { MembershipRow } from "../src/commands/memberships.js";

// Only the pure functions are tested here -- inviteMemberReal/
// acceptInvitationReal/hydrateInvitationByToken are real async
// Supabase IO, left untested, the same precedent this codebase
// already set repeatedly this session.

const invitation: InvitationRow = {
  id: "invitation-1", organizationId: "org-1", email: "jane@example.com", roles: ["ASSISTANT_SCORER"],
  token: "token-abc", status: "PENDING", expiresAt: "2026-10-10T00:00:00Z", invitedAt: "2026-10-01T00:00:00Z",
  invitedBy: "admin-1", acceptedAt: null,
};

describe("mapInvitationRowFromDb / mapInvitationRowToInsertRow / mapInvitationRowToUpdateRow (TASK-0155)", () => {
  it("maps snake_case DB columns to camelCase fields", () => {
    const row = mapInvitationRowFromDb({
      id: "invitation-1", organization_id: "org-1", email: "jane@example.com", roles: ["ASSISTANT_SCORER"],
      token: "token-abc", status: "PENDING", expires_at: "2026-10-10T00:00:00Z", invited_at: "2026-10-01T00:00:00Z",
      invited_by: "admin-1", accepted_at: null,
    });
    expect(row).toEqual(invitation);
  });

  it("maps a full insert row for a newly-sent invitation", () => {
    expect(mapInvitationRowToInsertRow(invitation)).toMatchObject({ id: "invitation-1", email: "jane@example.com", status: "PENDING", accepted_at: null });
  });

  it("maps only status/acceptedAt for an accepted invitation's update", () => {
    const accepted: InvitationRow = { ...invitation, status: "ACCEPTED", acceptedAt: "2026-10-05T00:00:00Z" };
    expect(mapInvitationRowToUpdateRow(accepted)).toEqual({ status: "ACCEPTED", accepted_at: "2026-10-05T00:00:00Z" });
  });
});

describe("mapMembershipRowToInsertRow (TASK-0155)", () => {
  it("maps a full insert row for a new invite-accepted membership", () => {
    const row: MembershipRow = {
      id: "membership-1", userId: "user-1", organizationId: "org-1", roles: ["ASSISTANT_SCORER"], status: "ACTIVE",
      invitedAt: "2026-10-01T00:00:00Z", acceptedAt: "2026-10-05T00:00:00Z", rowVersion: 1,
      createdAt: "2026-10-05T00:00:00Z", createdBy: "admin-1", updatedAt: "2026-10-05T00:00:00Z", updatedBy: "admin-1",
    };

    expect(mapMembershipRowToInsertRow(row)).toEqual({
      id: "membership-1", user_id: "user-1", organization_id: "org-1", roles: ["ASSISTANT_SCORER"], status: "ACTIVE",
      invited_at: "2026-10-01T00:00:00Z", accepted_at: "2026-10-05T00:00:00Z", row_version: 1,
      created_at: "2026-10-05T00:00:00Z", created_by: "admin-1", updated_at: "2026-10-05T00:00:00Z", updated_by: "admin-1",
    });
  });
});

describe("emailMatchesInvitation (TASK-0155)", () => {
  it("matches identical emails", () => {
    expect(emailMatchesInvitation("jane@example.com", invitation)).toBe(true);
  });

  it("matches case-insensitively -- an invited address and a signed-up address differing only in case is a real, plausible mismatch", () => {
    expect(emailMatchesInvitation("Jane@Example.com", invitation)).toBe(true);
  });

  it("rejects a genuinely different email", () => {
    expect(emailMatchesInvitation("someone-else@example.com", invitation)).toBe(false);
  });

  it("rejects when the user has no email at all (null/undefined)", () => {
    expect(emailMatchesInvitation(null, invitation)).toBe(false);
    expect(emailMatchesInvitation(undefined, invitation)).toBe(false);
  });
});
