import { describe, expect, it } from "vitest";
import { mapOrganizationRowFromDb, mapOrganizationRowToUpdateRow } from "../src/commands/organizationLifecyclePersistence.js";
import type { OrganizationRow } from "../src/commands/organizations.js";

// Only the pure mapping functions are tested here --
// isOrganizationAdmin/suspendOrganizationReal/reactivateOrganizationReal/
// deleteOrganizationReal/hydrateOrganization/persistOrganizationUpdate
// are real async Supabase IO, left untested, the same precedent this
// codebase already set repeatedly this session.

describe("mapOrganizationRowFromDb / mapOrganizationRowToUpdateRow (TASK-0152)", () => {
  it("maps snake_case DB columns to camelCase fields", () => {
    const row = mapOrganizationRowFromDb({
      id: "org-1", name: "Test Org", branding: null, status: "ACTIVE", row_version: 1,
      created_at: "2026-10-01T00:00:00Z", created_by: "admin-1", updated_at: "2026-10-02T00:00:00Z", updated_by: "admin-2",
    });

    expect(row).toEqual({
      id: "org-1", name: "Test Org", branding: null, status: "ACTIVE", rowVersion: 1,
      createdAt: "2026-10-01T00:00:00Z", createdBy: "admin-1", updatedAt: "2026-10-02T00:00:00Z", updatedBy: "admin-2",
    });
  });

  it("maps only the three mutable fields for an update", () => {
    const row: OrganizationRow = {
      id: "org-1", name: "Test Org", branding: null, status: "SUSPENDED", rowVersion: 2,
      createdAt: "now", createdBy: "admin-1", updatedAt: "later", updatedBy: "admin-2",
    };

    expect(mapOrganizationRowToUpdateRow(row)).toEqual({ status: "SUSPENDED", row_version: 2, updated_at: "later", updated_by: "admin-2" });
  });
});
