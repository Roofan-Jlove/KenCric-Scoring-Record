/**
 * TASK-0103: export-job tracker (`api-specification.md §15.1/§15.2`) --
 * the state machine behind `POST /matches/{matchId}/exports` and
 * `GET /exports/{exportId}`, plus the worker-side transition functions
 * a rendering worker would call into. Picked after `§11`'s own
 * remaining P1 commands (sign-off, account export/delete, auth) all
 * turned out to need real infrastructure this backend doesn't have
 * yet -- this generic job tracker unblocks account export/delete
 * (`§11.9`'s own text: "personal-data export reuses the same
 * export-job mechanism as a match scorecard export").
 *
 * `data-specification.md` has no `export_jobs`-style table anywhere in
 * its own catalogue -- only a generic `EXPORT` category inside
 * `audit_log.category`'s enum, which records that an export happened,
 * not a queryable job record. Unlike `invitations` (TASK-0102's own
 * finding, where even the field list was ambiguous), `§15.1`/`§15.2`'s
 * own request/response contracts already give the complete field
 * shape for this resource -- `ExportJobRow` below is a direct
 * transcription of that already-fully-specified API contract, not an
 * invention.
 *
 * `§15`'s own header cites `NFR-030` for rate-limiting, but SRS
 * `NFR-030` is "Cricsheet schema conformance," unrelated -- the real
 * entry is `SEC-010` ("Rate limiting and abuse protection"), which
 * traces to discovery `NFR-030`. `SEC-010` is `Should·P2` -- not MVP
 * scope -- so rate-limiting is correctly not implemented here.
 *
 * The real PDF/CSV/Cricsheet rendering is out of scope -- `§15.1`'s
 * own text says exports are "always asynchronous," meaning a worker
 * process does the real rendering; this module builds the job-
 * tracking state machine a worker would call into, not the rendering
 * itself.
 */

import { invalidTransitionError, notFoundError, schemaValidationError, type ProblemDetails } from "../authz/errors.js";

export const VALID_EXPORT_FORMATS = ["PDF", "CSV", "CRICSHEET"] as const;

export type ExportFormat = (typeof VALID_EXPORT_FORMATS)[number];
export type ExportStatus = "QUEUED" | "PROCESSING" | "READY" | "FAILED";

export interface ExportJobRow {
  exportId: string;
  matchId: string;
  format: ExportFormat;
  includeBranding: boolean;
  status: ExportStatus;
  downloadUrl: string | null;
  expiresAt: string | null;
  failureReason: string | null;
  requestedBy: string;
  queuedAt: string;
}

export interface ExportJobStore {
  get(exportId: string): ExportJobRow | null;
  insert(row: ExportJobRow): void;
  update(row: ExportJobRow): void;
}

export interface CreateExportJobPayload {
  matchId: string;
  format: string;
  includeBranding?: boolean;
}

export type CreateExportJobResult =
  | { outcome: "queued"; row: ExportJobRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** Per-endpoint idempotency-key cache -- a third, independent instance
 * of the same interface shape `deactivateMember.ts`/`claimMatch.ts`
 * already define (idempotency is per-endpoint, `§8.2`). */
export interface IdempotencyStore {
  getPriorSuccess(key: string): CreateExportJobResult | null;
  recordSuccess(key: string, result: CreateExportJobResult): void;
}

/** `POST /matches/{matchId}/exports`. Always queues a new job --
 * `§15.1`'s own text: "always asynchronous, even for a small match,
 * so the contract is uniform regardless of size." */
export function createExportJob(
  payload: Partial<CreateExportJobPayload>,
  store: ExportJobStore,
  idempotencyStore: IdempotencyStore,
  idempotencyKey: string,
  actorRef: string,
  newExportId: string,
  nowIso: string,
  instance: string,
): CreateExportJobResult {
  const priorResult = idempotencyStore.getPriorSuccess(idempotencyKey);
  if (priorResult) {
    return priorResult;
  }

  if (!payload.matchId) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: matchId", instance) };
  }
  if (!payload.format || !(VALID_EXPORT_FORMATS as readonly string[]).includes(payload.format)) {
    return {
      outcome: "rejected",
      problem: schemaValidationError(`format must be one of ${VALID_EXPORT_FORMATS.join(", ")}`, instance),
    };
  }

  const row: ExportJobRow = {
    exportId: newExportId,
    matchId: payload.matchId,
    format: payload.format as ExportFormat,
    includeBranding: payload.includeBranding ?? false,
    status: "QUEUED",
    downloadUrl: null,
    expiresAt: null,
    failureReason: null,
    requestedBy: actorRef,
    queuedAt: nowIso,
  };

  store.insert(row);

  const result: CreateExportJobResult = { outcome: "queued", row };
  idempotencyStore.recordSuccess(idempotencyKey, result);
  return result;
}

export type GetExportJobResult =
  | { outcome: "found"; row: ExportJobRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `GET /exports/{exportId}`. */
export function getExportJob(exportId: string, store: ExportJobStore, instance: string): GetExportJobResult {
  const row = store.get(exportId);
  if (!row) {
    return { outcome: "rejected", problem: notFoundError(`No export job visible with id ${exportId}`, instance) };
  }
  return { outcome: "found", row };
}

export type ExportJobTransitionResult =
  | { outcome: "transitioned"; row: ExportJobRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** Worker-side transition: `QUEUED` -> `PROCESSING` only. */
export function markExportProcessing(exportId: string, store: ExportJobStore, instance: string): ExportJobTransitionResult {
  const existing = store.get(exportId);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No export job visible with id ${exportId}`, instance) };
  }
  if (existing.status !== "QUEUED") {
    return {
      outcome: "rejected",
      problem: invalidTransitionError(`Export job ${exportId} is ${existing.status}, not QUEUED -- cannot start processing`, instance),
    };
  }
  const updated: ExportJobRow = { ...existing, status: "PROCESSING" };
  store.update(updated);
  return { outcome: "transitioned", row: updated };
}

/** Worker-side transition: `PROCESSING` -> `READY` only, with the
 * signed download details. */
export function markExportReady(
  exportId: string,
  downloadUrl: string,
  expiresAt: string,
  store: ExportJobStore,
  instance: string,
): ExportJobTransitionResult {
  const existing = store.get(exportId);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No export job visible with id ${exportId}`, instance) };
  }
  if (existing.status !== "PROCESSING") {
    return {
      outcome: "rejected",
      problem: invalidTransitionError(`Export job ${exportId} is ${existing.status}, not PROCESSING -- cannot mark ready`, instance),
    };
  }
  const updated: ExportJobRow = { ...existing, status: "READY", downloadUrl, expiresAt };
  store.update(updated);
  return { outcome: "transitioned", row: updated };
}

/** Worker-side transition: `PROCESSING` -> `FAILED` only. */
export function markExportFailed(exportId: string, failureReason: string, store: ExportJobStore, instance: string): ExportJobTransitionResult {
  const existing = store.get(exportId);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No export job visible with id ${exportId}`, instance) };
  }
  if (existing.status !== "PROCESSING") {
    return {
      outcome: "rejected",
      problem: invalidTransitionError(`Export job ${exportId} is ${existing.status}, not PROCESSING -- cannot mark failed`, instance),
    };
  }
  const updated: ExportJobRow = { ...existing, status: "FAILED", failureReason };
  store.update(updated);
  return { outcome: "transitioned", row: updated };
}

/** An in-memory ExportJobStore for tests -- not a production adapter. */
export class InMemoryExportJobStore implements ExportJobStore {
  private readonly rows = new Map<string, ExportJobRow>();

  get(exportId: string): ExportJobRow | null {
    return this.rows.get(exportId) ?? null;
  }

  insert(row: ExportJobRow): void {
    this.rows.set(row.exportId, row);
  }

  update(row: ExportJobRow): void {
    this.rows.set(row.exportId, row);
  }
}

/** An in-memory IdempotencyStore for tests -- not a production adapter. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly successesByKey = new Map<string, CreateExportJobResult>();

  getPriorSuccess(key: string): CreateExportJobResult | null {
    return this.successesByKey.get(key) ?? null;
  }

  recordSuccess(key: string, result: CreateExportJobResult): void {
    this.successesByKey.set(key, result);
  }
}
