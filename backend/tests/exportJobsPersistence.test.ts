import { describe, expect, it } from "vitest";
import { mapExportJobRowToInsertRow } from "../src/commands/exportJobsPersistence.js";
import type { ExportJobRow } from "../src/commands/exportJobs.js";

// Only mapExportJobRowToInsertRow is pure and unit-tested here --
// persistExportJob/createExportJobReal are real async Supabase IO,
// left untested, the same precedent roleContext.ts/session.ts/
// syncEventsPersistence.ts/signOffMatchPersistence.ts already set.

describe("mapExportJobRowToInsertRow (TASK-0150)", () => {
  it("maps every field to its snake_case column", () => {
    const row: ExportJobRow = {
      exportId: "export-1",
      matchId: "match-1",
      format: "PDF",
      includeBranding: true,
      status: "QUEUED",
      downloadUrl: null,
      expiresAt: null,
      failureReason: null,
      requestedBy: "user-1",
      queuedAt: "2026-10-05T00:00:00Z",
    };

    expect(mapExportJobRowToInsertRow(row)).toEqual({
      export_id: "export-1",
      match_id: "match-1",
      format: "PDF",
      include_branding: true,
      status: "QUEUED",
      download_url: null,
      expires_at: null,
      failure_reason: null,
      requested_by: "user-1",
      queued_at: "2026-10-05T00:00:00Z",
    });
  });

  it("carries a READY job's downloadUrl/expiresAt through unchanged", () => {
    const row: ExportJobRow = {
      exportId: "export-1", matchId: "match-1", format: "CSV", includeBranding: false, status: "READY",
      downloadUrl: "https://example.com/export-1.csv", expiresAt: "2026-10-06T00:00:00Z", failureReason: null,
      requestedBy: "user-1", queuedAt: "2026-10-05T00:00:00Z",
    };

    const mapped = mapExportJobRowToInsertRow(row);
    expect(mapped.download_url).toBe("https://example.com/export-1.csv");
    expect(mapped.expires_at).toBe("2026-10-06T00:00:00Z");
  });
});
