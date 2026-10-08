/**
 * TASK-0104: `POST /users/me/export` and `DELETE /users/me`
 * (`api-specification.md §11.9`) -- the third `§11` match-lifecycle
 * command task, unblocked by `TASK-0103`'s own export-job tracker.
 *
 * `§11.9`'s own Trace cites `FR-010/011` (both clean), `BR-025`,
 * `NFR-032`, `AUD-014`. SRS `BR-025` is "Bowler over rules," wholly
 * unrelated; SRS `NFR-032` is "Stable external identifiers," also
 * unrelated. The real entries are `BR-023` ("Deactivated-member
 * authorship retained" -- the same SRS rule `TASK-0101` already used,
 * since it traces to BOTH discovery `BR-024` and `BR-025`
 * consolidated) and `NFR-038` ("Data-protection compliance... data
 * export and erasure," traces to discovery `NFR-032`). `AUD-014`
 * ("Retention and anonymisation") was already correctly cited -- its
 * own Trace line (discovery `BR-025`; `NFR-032`; `SEC-015`)
 * independently confirms both substitutions. `SEC-015` ("Export/
 * erasure integrity") is a real on-topic citation missing from
 * `§11.9`'s own Trace entirely -- added here.
 *
 * `§11.9`'s own text says personal-data export "reuses the same
 * export-job mechanism as a match scorecard export" (`§15`,
 * `TASK-0103`). True code-level reuse would mean generalizing
 * `exportJobs.ts`'s `matchId`-specific `ExportJobRow` into a subject-
 * agnostic shape. Deliberately NOT done here -- this module builds a
 * parallel, intentionally-duplicated state machine instead, reusing
 * the identical *pattern* (same transition-guard shape, same per-
 * endpoint Idempotency-Key discipline) without touching a previously-
 * merged, already-tested task's own contract uninvited.
 *
 * `DELETE /users/me` has no polling counterpart -- `§11.9`'s own
 * text: completion is "communicated to the user by email..., not by
 * polling this endpoint." `markAccountDeletionCompleted` is a worker-
 * side function, not mapped to any client-facing endpoint.
 *
 * `users` itself is NOT a `§6.1` generic-CRUD resource (the original
 * rule's "10 remaining resources" count is exactly matched by the 9
 * built in `TASK-0093`-`0100` plus `matches`) -- this module models
 * only the minimal `AccountDeletionStore` surface this one command
 * needs, not a full user-profile CRUD module; auth/profile fields are
 * Supabase-managed (`§11.10`).
 */
import { invalidTransitionError, notFoundError, schemaValidationError } from "./errors.js";
/** `POST /users/me/export`. Always queues -- an async job, per `§15.2`'s
 * own mechanism. */
export function requestPersonalDataExport(userId, store, idempotencyStore, idempotencyKey, newExportId, nowIso, instance) {
    const priorResult = idempotencyStore.getPriorSuccess(idempotencyKey);
    if (priorResult) {
        return priorResult;
    }
    if (!userId) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: userId", instance) };
    }
    const row = {
        exportId: newExportId,
        userId,
        status: "QUEUED",
        downloadUrl: null,
        expiresAt: null,
        failureReason: null,
        requestedAt: nowIso,
    };
    store.insert(row);
    const result = { outcome: "queued", row };
    idempotencyStore.recordSuccess(idempotencyKey, result);
    return result;
}
export function getPersonalDataExport(exportId, store, instance) {
    const row = store.get(exportId);
    if (!row) {
        return { outcome: "rejected", problem: notFoundError(`No personal-data export visible with id ${exportId}`, instance) };
    }
    return { outcome: "found", row };
}
function invalidExportTransition(exportId, from, to, instance) {
    return {
        outcome: "rejected",
        problem: invalidTransitionError(`Personal-data export ${exportId} is ${from} -- cannot transition to ${to} from there`, instance),
    };
}
/** Worker-side: `QUEUED` -> `PROCESSING` only. */
export function markPersonalDataExportProcessing(exportId, store, instance) {
    const existing = store.get(exportId);
    if (!existing) {
        return { outcome: "rejected", problem: notFoundError(`No personal-data export visible with id ${exportId}`, instance) };
    }
    if (existing.status !== "QUEUED") {
        return invalidExportTransition(exportId, existing.status, "PROCESSING", instance);
    }
    const updated = { ...existing, status: "PROCESSING" };
    store.update(updated);
    return { outcome: "transitioned", row: updated };
}
/** Worker-side: `PROCESSING` -> `READY` only. */
export function markPersonalDataExportReady(exportId, downloadUrl, expiresAt, store, instance) {
    const existing = store.get(exportId);
    if (!existing) {
        return { outcome: "rejected", problem: notFoundError(`No personal-data export visible with id ${exportId}`, instance) };
    }
    if (existing.status !== "PROCESSING") {
        return invalidExportTransition(exportId, existing.status, "READY", instance);
    }
    const updated = { ...existing, status: "READY", downloadUrl, expiresAt };
    store.update(updated);
    return { outcome: "transitioned", row: updated };
}
/** Worker-side: `PROCESSING` -> `FAILED` only. */
export function markPersonalDataExportFailed(exportId, failureReason, store, instance) {
    const existing = store.get(exportId);
    if (!existing) {
        return { outcome: "rejected", problem: notFoundError(`No personal-data export visible with id ${exportId}`, instance) };
    }
    if (existing.status !== "PROCESSING") {
        return invalidExportTransition(exportId, existing.status, "FAILED", instance);
    }
    const updated = { ...existing, status: "FAILED", failureReason };
    store.update(updated);
    return { outcome: "transitioned", row: updated };
}
/**
 * `DELETE /users/me`. Marks the account `PROCESSING` for an
 * asynchronous anonymisation sweep. Re-requesting deletion of an
 * account already `PROCESSING` or `COMPLETED` (a genuinely new key)
 * is a safe no-op -- the same reasoning `deactivateMember`'s own
 * no-op used (`TASK-0101`); by the time deletion is `COMPLETED` the
 * account is anonymised and effectively unable to re-authenticate to
 * call this endpoint again, making this mostly a defensive
 * completeness case, not a load-bearing one.
 */
export function requestAccountDeletion(userId, store, idempotencyStore, idempotencyKey, nowIso, instance) {
    const priorResult = idempotencyStore.getPriorSuccess(idempotencyKey);
    if (priorResult) {
        return priorResult;
    }
    if (!userId) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: userId", instance) };
    }
    const existing = store.get(userId);
    if (existing && (existing.status === "PROCESSING" || existing.status === "COMPLETED")) {
        const result = { outcome: "processing", row: existing };
        idempotencyStore.recordSuccess(idempotencyKey, result);
        return result;
    }
    const row = {
        userId,
        status: "PROCESSING",
        requestedAt: nowIso,
        completedAt: null,
    };
    store.insert(row);
    const result = { outcome: "processing", row };
    idempotencyStore.recordSuccess(idempotencyKey, result);
    return result;
}
/** Worker-side: `PROCESSING` -> `COMPLETED` only. Not a client
 * endpoint -- there is no `GET` for deletion status at all. */
export function markAccountDeletionCompleted(userId, nowIso, store, instance) {
    const existing = store.get(userId);
    if (!existing) {
        return { outcome: "rejected", problem: notFoundError(`No deletion request visible for user ${userId}`, instance) };
    }
    if (existing.status !== "PROCESSING") {
        return {
            outcome: "rejected",
            problem: invalidTransitionError(`Deletion for user ${userId} is ${existing.status}, not PROCESSING`, instance),
        };
    }
    const updated = { ...existing, status: "COMPLETED", completedAt: nowIso };
    store.update(updated);
    return { outcome: "transitioned", row: updated };
}
/* ---------------------------------------------------------------- */
/* In-memory test doubles -- not production adapters                */
/* ---------------------------------------------------------------- */
export class InMemoryPersonalDataExportStore {
    rows = new Map();
    get(exportId) {
        return this.rows.get(exportId) ?? null;
    }
    insert(row) {
        this.rows.set(row.exportId, row);
    }
    update(row) {
        this.rows.set(row.exportId, row);
    }
}
export class InMemoryExportIdempotencyStore {
    successesByKey = new Map();
    getPriorSuccess(key) {
        return this.successesByKey.get(key) ?? null;
    }
    recordSuccess(key, result) {
        this.successesByKey.set(key, result);
    }
}
export class InMemoryAccountDeletionStore {
    rows = new Map();
    get(userId) {
        return this.rows.get(userId) ?? null;
    }
    insert(row) {
        this.rows.set(row.userId, row);
    }
    update(row) {
        this.rows.set(row.userId, row);
    }
}
export class InMemoryDeletionIdempotencyStore {
    successesByKey = new Map();
    getPriorSuccess(key) {
        return this.successesByKey.get(key) ?? null;
    }
    recordSuccess(key, result) {
        this.successesByKey.set(key, result);
    }
}
//# sourceMappingURL=accountDataLifecycle.js.map