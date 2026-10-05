/**
 * TASK-0157: the real Postgres I/O layer for the `request-personal-
 * data-export`/`request-account-deletion` Edge Functions, continuing
 * `TASK-0148`-`0156`'s architecture-faithful pattern after "mint the
 * next task and continue." The LAST already-built, already-tested
 * command module on memory's own tracked list -- `mergePlayers.ts`
 * remains explicitly skipped (`PlayerAppearanceLookup` has no real
 * backing anywhere in this backlog). Once this task ships, the
 * "wire an already-built command module" Edge Function series is
 * fully exhausted; further work needs genuinely new direction.
 *
 * **A real, blocking schema gap resolved within this same task, the
 * identical shape `TASK-0149`'s own `idempotency_keys` RCR already
 * used:** no `personal_data_exports`/`account_deletion_requests`
 * tables existed anywhere -- `accountDataLifecycle.ts`'s own
 * `TASK-0104` doc comment had already explained why (a deliberate
 * parallel state machine, not a generalisation of `export_jobs`'
 * table). Added `§10.5`/`§10.6` (new tables, 31st/32nd in `data-
 * specification.md`), direct transcriptions of this module's own
 * already-decided row shapes.
 *
 * **A genuinely different situation from the last five tasks --
 * `§11.9`'s own Authz is "the user themselves only," found by reading
 * the spec line directly rather than assuming the two-client pattern
 * applies by default:** no org-admin/scorer check is needed at all;
 * `userId` is never even a path parameter (the real endpoints are
 * literally `/users/me/export`/`/users/me`), it is always the
 * authenticated caller's own id. Because this task mints its OWN new
 * tables rather than retrofitting onto an already-restrictive one, the
 * grants were designed correctly from the start (`INSERT`/`SELECT` to
 * `authenticated`, gated by `user_id = auth.uid()`) -- there is no
 * "no write grant" gap to find and fix here, unlike `TASK-0151`-`0156`.
 * **A single user-scoped client is used throughout, breaking the
 * two-client streak** -- there is no privileged write to escalate to;
 * the user's own session is sufficient for both read and write.
 *
 * **Worker-side transition functions
 * (`markPersonalDataExportProcessing`/`Ready`/`Failed`,
 * `markAccountDeletionCompleted`) are NOT wired to any Edge Function**
 * -- same deliberate scope boundary `exportJobs.ts`'s own worker-side
 * functions already carry (`TASK-0150`): a future rendering/
 * anonymisation worker process, a different runtime, calls these
 * directly against the service role, never via an HTTP-triggered
 * command endpoint.
 *
 * Same pure-core/IO-shell split as every prior task:
 * `requestPersonalDataExport()`/`requestAccountDeletion()` are both
 * unmodified. Each reuses `idempotencyKeys.ts` (`TASK-0149`) directly,
 * with its own distinct `endpoint` string -- the third and fourth real
 * consumers of that module, after `signOffMatchPersistence.ts`/
 * `exportJobsPersistence.ts`.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  requestAccountDeletion,
  requestPersonalDataExport,
  InMemoryAccountDeletionStore,
  InMemoryDeletionIdempotencyStore,
  InMemoryExportIdempotencyStore,
  InMemoryPersonalDataExportStore,
  type AccountDeletionRequestRow,
  type PersonalDataExportRow,
  type RequestAccountDeletionResult,
  type RequestPersonalDataExportResult,
} from "./accountDataLifecycle.js";
import { getPriorSuccessFromDb, recordSuccessToDb } from "./idempotencyKeys.js";

const EXPORT_ENDPOINT = "personal-data-export";
const DELETION_ENDPOINT = "account-deletion";

export function mapPersonalDataExportRowToInsertRow(row: PersonalDataExportRow): Record<string, unknown> {
  return {
    export_id: row.exportId,
    user_id: row.userId,
    status: row.status,
    download_url: row.downloadUrl,
    expires_at: row.expiresAt,
    failure_reason: row.failureReason,
    requested_at: row.requestedAt,
  };
}

export function mapAccountDeletionRowToInsertRow(row: AccountDeletionRequestRow): Record<string, unknown> {
  return { user_id: row.userId, status: row.status, requested_at: row.requestedAt, completed_at: row.completedAt };
}

export function mapAccountDeletionRowFromDb(row: Record<string, unknown>): AccountDeletionRequestRow {
  return {
    userId: row.user_id as string,
    status: row.status as AccountDeletionRequestRow["status"],
    requestedAt: row.requested_at as string,
    completedAt: (row.completed_at as string) ?? null,
  };
}

export interface RequestPersonalDataExportRealInput {
  userId: string;
  idempotencyKey: string;
  newExportId: string;
  nowIso: string;
  instance: string;
}

/** `POST /users/me/export`. */
export async function requestPersonalDataExportReal(client: SupabaseClient, input: RequestPersonalDataExportRealInput): Promise<RequestPersonalDataExportResult> {
  const priorSuccess = await getPriorSuccessFromDb<RequestPersonalDataExportResult>(client, EXPORT_ENDPOINT, input.idempotencyKey);
  if (priorSuccess) return priorSuccess;

  const result = requestPersonalDataExport(
    input.userId,
    new InMemoryPersonalDataExportStore(),
    new InMemoryExportIdempotencyStore(),
    input.idempotencyKey,
    input.newExportId,
    input.nowIso,
    input.instance,
  );

  if (result.outcome === "queued") {
    const { error } = await client.from("personal_data_exports").insert(mapPersonalDataExportRowToInsertRow(result.row));
    if (error) throw new Error(`requestPersonalDataExportReal: personal_data_exports insert failed: ${error.message}`);
    await recordSuccessToDb(client, EXPORT_ENDPOINT, input.idempotencyKey, result);
  }

  return result;
}

export interface RequestAccountDeletionRealInput {
  userId: string;
  idempotencyKey: string;
  nowIso: string;
  instance: string;
}

/** `DELETE /users/me`. */
export async function requestAccountDeletionReal(client: SupabaseClient, input: RequestAccountDeletionRealInput): Promise<RequestAccountDeletionResult> {
  const priorSuccess = await getPriorSuccessFromDb<RequestAccountDeletionResult>(client, DELETION_ENDPOINT, input.idempotencyKey);
  if (priorSuccess) return priorSuccess;

  const { data, error: fetchError } = await client.from("account_deletion_requests").select("*").eq("user_id", input.userId).maybeSingle();
  if (fetchError) throw new Error(`requestAccountDeletionReal: account_deletion_requests query failed: ${fetchError.message}`);

  const store = new InMemoryAccountDeletionStore();
  if (data) store.insert(mapAccountDeletionRowFromDb(data as Record<string, unknown>));

  const result = requestAccountDeletion(input.userId, store, new InMemoryDeletionIdempotencyStore(), input.idempotencyKey, input.nowIso, input.instance);

  if (result.outcome === "processing" && !data) {
    const { error } = await client.from("account_deletion_requests").insert(mapAccountDeletionRowToInsertRow(result.row));
    if (error) throw new Error(`requestAccountDeletionReal: account_deletion_requests insert failed: ${error.message}`);
  }

  if (result.outcome === "processing") {
    await recordSuccessToDb(client, DELETION_ENDPOINT, input.idempotencyKey, result);
  }

  return result;
}
