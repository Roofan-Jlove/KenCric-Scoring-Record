package com.kencric.scoring.api.accountdatalifecycle

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0117: a field-for-field Kotlin port of `backend/src/commands/
 * accountDataLifecycle.ts` (`TASK-0104`), the 12th of 13 Android
 * backend-command ports. No new research -- see that module's own doc
 * comment for the full grounding (the `BR-025`/`NFR-032` mis-citation
 * finding corrected to `BR-023`/`NFR-038`; the `SEC-015` addition; the
 * deliberate choice to duplicate `exportJobs`'s state-machine *pattern*
 * rather than share its code, mirrored here by NOT importing from
 * `api.exportjobs`).
 */

enum class PersonalExportStatus { QUEUED, PROCESSING, READY, FAILED }

data class PersonalDataExportRow(
    val exportId: String,
    val userId: String,
    val status: PersonalExportStatus,
    val downloadUrl: String?,
    val expiresAt: String?,
    val failureReason: String?,
    val requestedAt: String,
)

interface PersonalDataExportStore {
    fun get(exportId: String): PersonalDataExportRow?
    fun insert(row: PersonalDataExportRow)
    fun update(row: PersonalDataExportRow)
}

sealed class RequestPersonalDataExportResult {
    data class Queued(val row: PersonalDataExportRow) : RequestPersonalDataExportResult()
    data class Rejected(val problem: ApiProblem) : RequestPersonalDataExportResult()
}

/** Per-endpoint idempotency-key cache, scoped to export, distinct from deletion's own. */
interface ExportIdempotencyStore {
    fun getPriorSuccess(key: String): RequestPersonalDataExportResult?
    fun recordSuccess(key: String, result: RequestPersonalDataExportResult)
}

/** `POST /users/me/export`. Always queues -- an async job, per `§15.2`'s own mechanism. */
fun requestPersonalDataExport(
    userId: String,
    store: PersonalDataExportStore,
    idempotencyStore: ExportIdempotencyStore,
    idempotencyKey: String,
    newExportId: String,
    nowIso: String,
    instance: String,
): RequestPersonalDataExportResult {
    val priorResult = idempotencyStore.getPriorSuccess(idempotencyKey)
    if (priorResult != null) return priorResult

    if (userId.isEmpty()) {
        return RequestPersonalDataExportResult.Rejected(schemaValidationError("Missing required field: userId", instance))
    }

    val row = PersonalDataExportRow(
        exportId = newExportId,
        userId = userId,
        status = PersonalExportStatus.QUEUED,
        downloadUrl = null,
        expiresAt = null,
        failureReason = null,
        requestedAt = nowIso,
    )

    store.insert(row)

    val result = RequestPersonalDataExportResult.Queued(row)
    idempotencyStore.recordSuccess(idempotencyKey, result)
    return result
}

sealed class GetPersonalDataExportResult {
    data class Found(val row: PersonalDataExportRow) : GetPersonalDataExportResult()
    data class Rejected(val problem: ApiProblem) : GetPersonalDataExportResult()
}

fun getPersonalDataExport(exportId: String, store: PersonalDataExportStore, instance: String): GetPersonalDataExportResult {
    val row = store.get(exportId)
        ?: return GetPersonalDataExportResult.Rejected(notFoundError("No personal-data export visible with id $exportId", instance))
    return GetPersonalDataExportResult.Found(row)
}

sealed class PersonalExportTransitionResult {
    data class Transitioned(val row: PersonalDataExportRow) : PersonalExportTransitionResult()
    data class Rejected(val problem: ApiProblem) : PersonalExportTransitionResult()
}

private fun invalidExportTransition(exportId: String, from: PersonalExportStatus, to: String, instance: String): PersonalExportTransitionResult =
    PersonalExportTransitionResult.Rejected(
        invalidTransitionError("Personal-data export $exportId is $from -- cannot transition to $to from there", instance),
    )

/** Worker-side: `QUEUED` -> `PROCESSING` only. */
fun markPersonalDataExportProcessing(exportId: String, store: PersonalDataExportStore, instance: String): PersonalExportTransitionResult {
    val existing = store.get(exportId)
        ?: return PersonalExportTransitionResult.Rejected(notFoundError("No personal-data export visible with id $exportId", instance))
    if (existing.status != PersonalExportStatus.QUEUED) {
        return invalidExportTransition(exportId, existing.status, "PROCESSING", instance)
    }
    val updated = existing.copy(status = PersonalExportStatus.PROCESSING)
    store.update(updated)
    return PersonalExportTransitionResult.Transitioned(updated)
}

/** Worker-side: `PROCESSING` -> `READY` only. */
fun markPersonalDataExportReady(exportId: String, downloadUrl: String, expiresAt: String, store: PersonalDataExportStore, instance: String): PersonalExportTransitionResult {
    val existing = store.get(exportId)
        ?: return PersonalExportTransitionResult.Rejected(notFoundError("No personal-data export visible with id $exportId", instance))
    if (existing.status != PersonalExportStatus.PROCESSING) {
        return invalidExportTransition(exportId, existing.status, "READY", instance)
    }
    val updated = existing.copy(status = PersonalExportStatus.READY, downloadUrl = downloadUrl, expiresAt = expiresAt)
    store.update(updated)
    return PersonalExportTransitionResult.Transitioned(updated)
}

/** Worker-side: `PROCESSING` -> `FAILED` only. */
fun markPersonalDataExportFailed(exportId: String, failureReason: String, store: PersonalDataExportStore, instance: String): PersonalExportTransitionResult {
    val existing = store.get(exportId)
        ?: return PersonalExportTransitionResult.Rejected(notFoundError("No personal-data export visible with id $exportId", instance))
    if (existing.status != PersonalExportStatus.PROCESSING) {
        return invalidExportTransition(exportId, existing.status, "FAILED", instance)
    }
    val updated = existing.copy(status = PersonalExportStatus.FAILED, failureReason = failureReason)
    store.update(updated)
    return PersonalExportTransitionResult.Transitioned(updated)
}

/* ---------------------------------------------------------------- */
/* Account deletion (anonymisation sweep) -- no polling endpoint     */
/* ---------------------------------------------------------------- */

enum class AccountDeletionStatus { PROCESSING, COMPLETED }

data class AccountDeletionRequestRow(
    val userId: String,
    val status: AccountDeletionStatus,
    val requestedAt: String,
    val completedAt: String?,
)

interface AccountDeletionStore {
    fun get(userId: String): AccountDeletionRequestRow?
    fun insert(row: AccountDeletionRequestRow)
    fun update(row: AccountDeletionRequestRow)
}

sealed class RequestAccountDeletionResult {
    data class Processing(val row: AccountDeletionRequestRow) : RequestAccountDeletionResult()
    data class Rejected(val problem: ApiProblem) : RequestAccountDeletionResult()
}

/** Per-endpoint idempotency-key cache, scoped to deletion, distinct from export's own. */
interface DeletionIdempotencyStore {
    fun getPriorSuccess(key: String): RequestAccountDeletionResult?
    fun recordSuccess(key: String, result: RequestAccountDeletionResult)
}

/**
 * `DELETE /users/me`. Marks the account `PROCESSING` for an
 * asynchronous anonymisation sweep. Re-requesting deletion of an
 * account already `PROCESSING` or `COMPLETED` (a genuinely new key)
 * is a safe no-op -- the same reasoning `deactivateMember`'s own
 * no-op used.
 */
fun requestAccountDeletion(
    userId: String,
    store: AccountDeletionStore,
    idempotencyStore: DeletionIdempotencyStore,
    idempotencyKey: String,
    nowIso: String,
    instance: String,
): RequestAccountDeletionResult {
    val priorResult = idempotencyStore.getPriorSuccess(idempotencyKey)
    if (priorResult != null) return priorResult

    if (userId.isEmpty()) {
        return RequestAccountDeletionResult.Rejected(schemaValidationError("Missing required field: userId", instance))
    }

    val existing = store.get(userId)
    if (existing != null && (existing.status == AccountDeletionStatus.PROCESSING || existing.status == AccountDeletionStatus.COMPLETED)) {
        val result = RequestAccountDeletionResult.Processing(existing)
        idempotencyStore.recordSuccess(idempotencyKey, result)
        return result
    }

    val row = AccountDeletionRequestRow(
        userId = userId,
        status = AccountDeletionStatus.PROCESSING,
        requestedAt = nowIso,
        completedAt = null,
    )

    store.insert(row)

    val result = RequestAccountDeletionResult.Processing(row)
    idempotencyStore.recordSuccess(idempotencyKey, result)
    return result
}

sealed class AccountDeletionTransitionResult {
    data class Transitioned(val row: AccountDeletionRequestRow) : AccountDeletionTransitionResult()
    data class Rejected(val problem: ApiProblem) : AccountDeletionTransitionResult()
}

/** Worker-side: `PROCESSING` -> `COMPLETED` only. Not a client endpoint -- there is no `GET` for deletion status at all. */
fun markAccountDeletionCompleted(userId: String, nowIso: String, store: AccountDeletionStore, instance: String): AccountDeletionTransitionResult {
    val existing = store.get(userId)
        ?: return AccountDeletionTransitionResult.Rejected(notFoundError("No deletion request visible for user $userId", instance))
    if (existing.status != AccountDeletionStatus.PROCESSING) {
        return AccountDeletionTransitionResult.Rejected(
            invalidTransitionError("Deletion for user $userId is ${existing.status}, not PROCESSING", instance),
        )
    }
    val updated = existing.copy(status = AccountDeletionStatus.COMPLETED, completedAt = nowIso)
    store.update(updated)
    return AccountDeletionTransitionResult.Transitioned(updated)
}

/* ---------------------------------------------------------------- */
/* In-memory test doubles -- not production adapters                */
/* ---------------------------------------------------------------- */

class InMemoryPersonalDataExportStore : PersonalDataExportStore {
    private val rows = mutableMapOf<String, PersonalDataExportRow>()
    override fun get(exportId: String): PersonalDataExportRow? = rows[exportId]
    override fun insert(row: PersonalDataExportRow) { rows[row.exportId] = row }
    override fun update(row: PersonalDataExportRow) { rows[row.exportId] = row }
}

class InMemoryExportIdempotencyStore : ExportIdempotencyStore {
    private val successesByKey = mutableMapOf<String, RequestPersonalDataExportResult>()
    override fun getPriorSuccess(key: String): RequestPersonalDataExportResult? = successesByKey[key]
    override fun recordSuccess(key: String, result: RequestPersonalDataExportResult) { successesByKey[key] = result }
}

class InMemoryAccountDeletionStore : AccountDeletionStore {
    private val rows = mutableMapOf<String, AccountDeletionRequestRow>()
    override fun get(userId: String): AccountDeletionRequestRow? = rows[userId]
    override fun insert(row: AccountDeletionRequestRow) { rows[row.userId] = row }
    override fun update(row: AccountDeletionRequestRow) { rows[row.userId] = row }
}

class InMemoryDeletionIdempotencyStore : DeletionIdempotencyStore {
    private val successesByKey = mutableMapOf<String, RequestAccountDeletionResult>()
    override fun getPriorSuccess(key: String): RequestAccountDeletionResult? = successesByKey[key]
    override fun recordSuccess(key: String, result: RequestAccountDeletionResult) { successesByKey[key] = result }
}
