import { describe, expect, it } from "vitest";
import {
  mapAccountDeletionRowFromDb,
  mapAccountDeletionRowToInsertRow,
  mapPersonalDataExportRowToInsertRow,
} from "../src/commands/accountDataLifecyclePersistence.js";
import type { AccountDeletionRequestRow, PersonalDataExportRow } from "../src/commands/accountDataLifecycle.js";

// Only the pure mapping functions are tested here --
// requestPersonalDataExportReal/requestAccountDeletionReal are real
// async Supabase IO, left untested, the same precedent this codebase
// already set repeatedly this session.

describe("mapPersonalDataExportRowToInsertRow (TASK-0157)", () => {
  it("maps a freshly-queued export to its full insert row", () => {
    const row: PersonalDataExportRow = {
      exportId: "export-1", userId: "user-1", status: "QUEUED", downloadUrl: null, expiresAt: null,
      failureReason: null, requestedAt: "2026-10-05T00:00:00Z",
    };

    expect(mapPersonalDataExportRowToInsertRow(row)).toEqual({
      export_id: "export-1", user_id: "user-1", status: "QUEUED", download_url: null, expires_at: null,
      failure_reason: null, requested_at: "2026-10-05T00:00:00Z",
    });
  });
});

describe("mapAccountDeletionRowToInsertRow / mapAccountDeletionRowFromDb (TASK-0157)", () => {
  it("maps a freshly-requested deletion to its full insert row", () => {
    const row: AccountDeletionRequestRow = { userId: "user-1", status: "PROCESSING", requestedAt: "2026-10-05T00:00:00Z", completedAt: null };
    expect(mapAccountDeletionRowToInsertRow(row)).toEqual({ user_id: "user-1", status: "PROCESSING", requested_at: "2026-10-05T00:00:00Z", completed_at: null });
  });

  it("maps a DB row back into AccountDeletionRequestRow", () => {
    const row = mapAccountDeletionRowFromDb({ user_id: "user-1", status: "COMPLETED", requested_at: "2026-10-01T00:00:00Z", completed_at: "2026-10-05T00:00:00Z" });
    expect(row).toEqual({ userId: "user-1", status: "COMPLETED", requestedAt: "2026-10-01T00:00:00Z", completedAt: "2026-10-05T00:00:00Z" });
  });

  it("maps a PROCESSING (not yet completed) row with completedAt null", () => {
    const row = mapAccountDeletionRowFromDb({ user_id: "user-1", status: "PROCESSING", requested_at: "now", completed_at: null });
    expect(row.completedAt).toBeNull();
  });
});
