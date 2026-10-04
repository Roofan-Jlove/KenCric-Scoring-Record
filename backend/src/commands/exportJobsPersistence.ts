/**
 * TASK-0150: the real Postgres I/O layer for the `exports` Edge
 * Function (`database/supabase/functions/exports/index.ts`) --
 * `system-architecture.md §3.9`'s own named command-endpoint list
 * includes `/exports` alongside `/matches/:id/signoff`; `exportJobs.ts`
 * (`TASK-0103`) is already built and tested, making this the next
 * well-grounded, low-invention continuation of `TASK-0148`/`0149`'s
 * architecture-faithful pattern after "mint the next task and continue."
 *
 * **A real, blocking schema gap resolved within this same task, the
 * identical shape `TASK-0149`'s own `idempotency_keys` RCR already
 * used:** no `export_jobs` table existed anywhere in `data-
 * specification.md` -- `TASK-0103`'s own doc comment had already found
 * this exact gap and confirmed `§15.1`/`§15.2`'s own request/response
 * contract gives the complete field shape, so adding `§10.4` is a
 * direct transcription, not an invention. See that migration's own
 * header comment for the full reasoning.
 *
 * **`createExportJob`'s own `IdempotencyStore` reuses `TASK-0149`'s own
 * generic `idempotencyKeys.ts` directly** -- no new idempotency
 * mechanism was built, confirming that module's own design (parameterised
 * by `endpoint`, not sign-off-specific) actually generalises as intended
 * the first time a second consumer needed it.
 *
 * **Only `createExportJob` is wired to an Edge Function -- deliberately,
 * not an oversight:** `getExportJob` (`GET /exports/{exportId}`) is a
 * plain single-row read, which `system-architecture.md`'s own
 * architecture puts on **PostgREST**, not a hand-written Edge Function
 * (`§3.9`: "Resource reads | REST (PostgREST) behind RLS, read-only for
 * clients"). `export_jobs_select_own`'s own RLS policy already makes
 * this a correct, zero-code PostgREST read. `markExportProcessing`/
 * `markExportReady`/`markExportFailed` are `exportJobs.ts`'s own
 * "worker-side transition" functions, called by a future rendering
 * worker process -- a different runtime altogether, explicitly out of
 * `TASK-0103`'s own scope and out of this task's too; wiring them to an
 * HTTP-triggered Edge Function would misrepresent what calls them in a
 * real deployment.
 *
 * Same pure-core/IO-shell split as `TASK-0148`/`0149`: `createExportJob()`
 * itself is unmodified. `NOT integration-tested` -- same disclaimer as
 * every other IO function in this backlog.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPriorSuccessFromDb, recordSuccessToDb } from "./idempotencyKeys.js";
import {
  createExportJob,
  InMemoryExportJobStore,
  InMemoryIdempotencyStore,
  type CreateExportJobPayload,
  type CreateExportJobResult,
  type ExportJobRow,
} from "./exportJobs.js";

const ENDPOINT = "export-jobs";

/** Pure: camelCase `ExportJobRow` -> snake_case `export_jobs` insert row. */
export function mapExportJobRowToInsertRow(row: ExportJobRow): Record<string, unknown> {
  return {
    export_id: row.exportId,
    match_id: row.matchId,
    format: row.format,
    include_branding: row.includeBranding,
    status: row.status,
    download_url: row.downloadUrl,
    expires_at: row.expiresAt,
    failure_reason: row.failureReason,
    requested_by: row.requestedBy,
    queued_at: row.queuedAt,
  };
}

export async function persistExportJob(client: SupabaseClient, row: ExportJobRow): Promise<void> {
  const { error } = await client.from("export_jobs").insert(mapExportJobRowToInsertRow(row));
  if (error) throw new Error(`persistExportJob: export_jobs insert failed: ${error.message}`);
}

export interface CreateExportJobRealInput {
  payload: Partial<CreateExportJobPayload>;
  actorRef: string;
  idempotencyKey: string;
  newExportId: string;
  nowIso: string;
  instance: string;
}

/**
 * The real, end-to-end `POST /matches/{matchId}/exports` composition:
 * check the real idempotency cache first; on a miss, run the existing
 * unchanged `createExportJob()` against a throwaway in-memory store
 * (this wrapper, not the pure function, owns the real persistence
 * decision), and persist the result ONLY on `outcome === "queued"` --
 * mirroring `createExportJob()`'s own already-correct internal rule
 * (it calls `recordSuccess` only on its own success branch, never on a
 * schema-validation rejection), the same discipline `TASK-0149`'s
 * `signOffMatchReal` already established.
 */
export async function createExportJobReal(client: SupabaseClient, input: CreateExportJobRealInput): Promise<CreateExportJobResult> {
  const priorSuccess = await getPriorSuccessFromDb<CreateExportJobResult>(client, ENDPOINT, input.idempotencyKey);
  if (priorSuccess) return priorSuccess;

  const result = createExportJob(
    input.payload,
    new InMemoryExportJobStore(),
    new InMemoryIdempotencyStore(),
    input.idempotencyKey,
    input.actorRef,
    input.newExportId,
    input.nowIso,
    input.instance,
  );

  if (result.outcome === "queued") {
    await persistExportJob(client, result.row);
    await recordSuccessToDb(client, ENDPOINT, input.idempotencyKey, result);
  }

  return result;
}
