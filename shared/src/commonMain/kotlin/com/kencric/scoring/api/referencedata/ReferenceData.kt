package com.kencric.scoring.api.referencedata

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.businessRuleValidationError
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0113: a field-for-field Kotlin port of `backend/src/commands/
 * referenceData.ts` (`TASK-0100`). No new research -- see that
 * module's own doc comment for the full grounding (the genuinely
 * global `(kind, version)` PK despite the API spec's own org-scoped
 * URL; the strictest immutability model in this backlog; no `DELETE`
 * at all, by design).
 */

val VALID_REFERENCE_DATA_KINDS: List<String> = listOf("CONDITIONS_PROFILE", "DLS_TABLE", "APP_CONFIG")

enum class ReferenceDataKind { CONDITIONS_PROFILE, DLS_TABLE, APP_CONFIG }

data class ReferenceDataRow(
    val kind: ReferenceDataKind,
    val version: Int,
    val payload: Any?,
    val publishedAt: String,
    val publishedBy: String,
)

interface ReferenceDataStore {
    fun get(kind: String, version: Int): ReferenceDataRow?
    fun insert(row: ReferenceDataRow)
    fun listByKind(kind: String): List<ReferenceDataRow>
}

data class PublishReferenceDataPayload(
    val kind: String? = null,
    val version: Int? = null,
    val payload: Any? = null,
    val publishedBy: String? = null,
)

sealed class PublishReferenceDataResult {
    data class Published(val row: ReferenceDataRow) : PublishReferenceDataResult()
    data class Rejected(val problem: ApiProblem) : PublishReferenceDataResult()
}

/**
 * The only write operation this resource has. `version` must be
 * exactly `currentHighest + 1` for its `kind` -- an already-existing
 * version is `409` (no idempotency exception); a version that skips
 * ahead of the monotonic sequence is `422`.
 */
fun publishReferenceData(payload: PublishReferenceDataPayload, store: ReferenceDataStore, nowIso: String, instance: String): PublishReferenceDataResult {
    if (payload.kind.isNullOrEmpty() || !VALID_REFERENCE_DATA_KINDS.contains(payload.kind)) {
        return PublishReferenceDataResult.Rejected(schemaValidationError("kind must be one of ${VALID_REFERENCE_DATA_KINDS.joinToString(", ")}", instance))
    }
    if (payload.version == null) {
        return PublishReferenceDataResult.Rejected(schemaValidationError("Missing required field: version", instance))
    }
    if (payload.payload == null) {
        return PublishReferenceDataResult.Rejected(schemaValidationError("Missing required field: payload", instance))
    }
    if (payload.publishedBy.isNullOrEmpty()) {
        return PublishReferenceDataResult.Rejected(schemaValidationError("Missing required field: publishedBy", instance))
    }

    val kind = payload.kind

    if (store.get(kind, payload.version) != null) {
        return PublishReferenceDataResult.Rejected(
            invalidTransitionError("$kind version ${payload.version} is already published -- a change is always a new version, never an overwrite", instance),
        )
    }

    val existingVersions = store.listByKind(kind).map { it.version }
    val currentHighest = existingVersions.maxOrNull() ?: 0
    val expectedNext = currentHighest + 1

    if (payload.version != expectedNext) {
        return PublishReferenceDataResult.Rejected(
            businessRuleValidationError(
                "version must be exactly $expectedNext (the next version after the current highest, $currentHighest) -- got ${payload.version}",
                instance,
            ),
        )
    }

    val row = ReferenceDataRow(
        kind = ReferenceDataKind.valueOf(kind),
        version = payload.version,
        payload = payload.payload,
        publishedAt = nowIso,
        publishedBy = payload.publishedBy,
    )

    store.insert(row)
    return PublishReferenceDataResult.Published(row)
}

sealed class GetReferenceDataResult {
    data class Found(val row: ReferenceDataRow) : GetReferenceDataResult()
    data class Rejected(val problem: ApiProblem) : GetReferenceDataResult()
}

fun getReferenceData(kind: String, version: Int, store: ReferenceDataStore, instance: String): GetReferenceDataResult {
    val row = store.get(kind, version)
        ?: return GetReferenceDataResult.Rejected(notFoundError("No reference data visible for kind $kind, version $version", instance))
    return GetReferenceDataResult.Found(row)
}

/** Every version for one `kind`, oldest first. */
fun listReferenceData(kind: String, store: ReferenceDataStore): List<ReferenceDataRow> = store.listByKind(kind).sortedBy { it.version }

sealed class GetLatestReferenceDataResult {
    data class Found(val row: ReferenceDataRow) : GetLatestReferenceDataResult()
    data class Rejected(val problem: ApiProblem) : GetLatestReferenceDataResult()
}

/** `§5.4`'s own `IX: kind` note: "to fetch the latest quickly." The
 * highest-version row for a `kind`. */
fun getLatestReferenceData(kind: String, store: ReferenceDataStore, instance: String): GetLatestReferenceDataResult {
    val rows = store.listByKind(kind)
    if (rows.isEmpty()) {
        return GetLatestReferenceDataResult.Rejected(notFoundError("No reference data has ever been published for kind $kind", instance))
    }
    val latest = rows.reduce { highest, row -> if (row.version > highest.version) row else highest }
    return GetLatestReferenceDataResult.Found(latest)
}

private fun compositeKey(kind: String, version: Int): String = "$kind::$version"

/** An in-memory ReferenceDataStore for tests -- not a production adapter. */
class InMemoryReferenceDataStore : ReferenceDataStore {
    private val rows = mutableMapOf<String, ReferenceDataRow>()

    override fun get(kind: String, version: Int): ReferenceDataRow? = rows[compositeKey(kind, version)]
    override fun insert(row: ReferenceDataRow) { rows[compositeKey(row.kind.name, row.version)] = row }
    override fun listByKind(kind: String): List<ReferenceDataRow> = rows.values.filter { it.kind.name == kind }
}
