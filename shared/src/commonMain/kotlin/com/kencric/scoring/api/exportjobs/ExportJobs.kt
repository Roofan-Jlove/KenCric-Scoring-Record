package com.kencric.scoring.api.exportjobs

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0116: a field-for-field Kotlin port of `backend/src/commands/
 * exportJobs.ts` (`TASK-0103`). No new research -- see that module's
 * own doc comment for the full grounding (no `export_jobs` table
 * exists in `data-specification.md`, but `§15.1`/`§15.2`'s own
 * contract gives the complete field shape; the `NFR-030`→`SEC-010`
 * citation finding; the strictly-enforced state machine).
 */

val VALID_EXPORT_FORMATS: List<String> = listOf("PDF", "CSV", "CRICSHEET")

enum class ExportFormat { PDF, CSV, CRICSHEET }
enum class ExportStatus { QUEUED, PROCESSING, READY, FAILED }

data class ExportJobRow(
    val exportId: String,
    val matchId: String,
    val format: ExportFormat,
    val includeBranding: Boolean,
    val status: ExportStatus,
    val downloadUrl: String?,
    val expiresAt: String?,
    val failureReason: String?,
    val requestedBy: String,
    val queuedAt: String,
)

interface ExportJobStore {
    fun get(exportId: String): ExportJobRow?
    fun insert(row: ExportJobRow)
    fun update(row: ExportJobRow)
}

data class CreateExportJobPayload(
    val matchId: String? = null,
    val format: String? = null,
    val includeBranding: Boolean = false,
)

sealed class CreateExportJobResult {
    data class Queued(val row: ExportJobRow) : CreateExportJobResult()
    data class Rejected(val problem: ApiProblem) : CreateExportJobResult()
}

/** Per-endpoint idempotency-key cache -- a third, independent instance
 * of the same interface shape `deactivatemember`/`claimmatch` already
 * define. */
interface IdempotencyStore {
    fun getPriorSuccess(key: String): CreateExportJobResult?
    fun recordSuccess(key: String, result: CreateExportJobResult)
}

/** `POST /matches/{matchId}/exports`. Always queues a new job. */
fun createExportJob(
    payload: CreateExportJobPayload,
    store: ExportJobStore,
    idempotencyStore: IdempotencyStore,
    idempotencyKey: String,
    actorRef: String,
    newExportId: String,
    nowIso: String,
    instance: String,
): CreateExportJobResult {
    val priorResult = idempotencyStore.getPriorSuccess(idempotencyKey)
    if (priorResult != null) {
        return priorResult
    }

    if (payload.matchId.isNullOrEmpty()) {
        return CreateExportJobResult.Rejected(schemaValidationError("Missing required field: matchId", instance))
    }
    if (payload.format.isNullOrEmpty() || !VALID_EXPORT_FORMATS.contains(payload.format)) {
        return CreateExportJobResult.Rejected(schemaValidationError("format must be one of ${VALID_EXPORT_FORMATS.joinToString(", ")}", instance))
    }

    val row = ExportJobRow(
        exportId = newExportId,
        matchId = payload.matchId,
        format = ExportFormat.valueOf(payload.format),
        includeBranding = payload.includeBranding,
        status = ExportStatus.QUEUED,
        downloadUrl = null,
        expiresAt = null,
        failureReason = null,
        requestedBy = actorRef,
        queuedAt = nowIso,
    )

    store.insert(row)

    val result = CreateExportJobResult.Queued(row)
    idempotencyStore.recordSuccess(idempotencyKey, result)
    return result
}

sealed class GetExportJobResult {
    data class Found(val row: ExportJobRow) : GetExportJobResult()
    data class Rejected(val problem: ApiProblem) : GetExportJobResult()
}

/** `GET /exports/{exportId}`. */
fun getExportJob(exportId: String, store: ExportJobStore, instance: String): GetExportJobResult {
    val row = store.get(exportId) ?: return GetExportJobResult.Rejected(notFoundError("No export job visible with id $exportId", instance))
    return GetExportJobResult.Found(row)
}

sealed class ExportJobTransitionResult {
    data class Transitioned(val row: ExportJobRow) : ExportJobTransitionResult()
    data class Rejected(val problem: ApiProblem) : ExportJobTransitionResult()
}

/** Worker-side transition: `QUEUED` -> `PROCESSING` only. */
fun markExportProcessing(exportId: String, store: ExportJobStore, instance: String): ExportJobTransitionResult {
    val existing = store.get(exportId) ?: return ExportJobTransitionResult.Rejected(notFoundError("No export job visible with id $exportId", instance))
    if (existing.status != ExportStatus.QUEUED) {
        return ExportJobTransitionResult.Rejected(
            invalidTransitionError("Export job $exportId is ${existing.status}, not QUEUED -- cannot start processing", instance),
        )
    }
    val updated = existing.copy(status = ExportStatus.PROCESSING)
    store.update(updated)
    return ExportJobTransitionResult.Transitioned(updated)
}

/** Worker-side transition: `PROCESSING` -> `READY` only, with the
 * signed download details. */
fun markExportReady(exportId: String, downloadUrl: String, expiresAt: String, store: ExportJobStore, instance: String): ExportJobTransitionResult {
    val existing = store.get(exportId) ?: return ExportJobTransitionResult.Rejected(notFoundError("No export job visible with id $exportId", instance))
    if (existing.status != ExportStatus.PROCESSING) {
        return ExportJobTransitionResult.Rejected(
            invalidTransitionError("Export job $exportId is ${existing.status}, not PROCESSING -- cannot mark ready", instance),
        )
    }
    val updated = existing.copy(status = ExportStatus.READY, downloadUrl = downloadUrl, expiresAt = expiresAt)
    store.update(updated)
    return ExportJobTransitionResult.Transitioned(updated)
}

/** Worker-side transition: `PROCESSING` -> `FAILED` only. */
fun markExportFailed(exportId: String, failureReason: String, store: ExportJobStore, instance: String): ExportJobTransitionResult {
    val existing = store.get(exportId) ?: return ExportJobTransitionResult.Rejected(notFoundError("No export job visible with id $exportId", instance))
    if (existing.status != ExportStatus.PROCESSING) {
        return ExportJobTransitionResult.Rejected(
            invalidTransitionError("Export job $exportId is ${existing.status}, not PROCESSING -- cannot mark failed", instance),
        )
    }
    val updated = existing.copy(status = ExportStatus.FAILED, failureReason = failureReason)
    store.update(updated)
    return ExportJobTransitionResult.Transitioned(updated)
}

/** An in-memory ExportJobStore for tests -- not a production adapter. */
class InMemoryExportJobStore : ExportJobStore {
    private val rows = mutableMapOf<String, ExportJobRow>()

    override fun get(exportId: String): ExportJobRow? = rows[exportId]
    override fun insert(row: ExportJobRow) { rows[row.exportId] = row }
    override fun update(row: ExportJobRow) { rows[row.exportId] = row }
}

/** An in-memory IdempotencyStore for tests -- not a production adapter. */
class InMemoryIdempotencyStore : IdempotencyStore {
    private val successesByKey = mutableMapOf<String, CreateExportJobResult>()

    override fun getPriorSuccess(key: String): CreateExportJobResult? = successesByKey[key]
    override fun recordSuccess(key: String, result: CreateExportJobResult) { successesByKey[key] = result }
}
