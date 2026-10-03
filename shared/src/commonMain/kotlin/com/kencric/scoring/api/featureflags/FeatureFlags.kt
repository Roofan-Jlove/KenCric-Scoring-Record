package com.kencric.scoring.api.featureflags

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0137: a field-for-field Kotlin port of `backend/src/commands/
 * featureFlags.ts` (`TASK-0132`), the 21st and final Android backend-
 * command port of this round. No new research -- see that module's
 * own doc comment for the full grounding (the deliberate storage-only
 * scope boundary; `key` left unconstrained, no canonical flag-key
 * list exists anywhere in this corpus).
 */

data class FeatureFlagRow(
    val key: String,
    val enabled: Boolean,
    val updatedAt: String,
    val updatedBy: String,
)

interface FeatureFlagStore {
    fun get(key: String): FeatureFlagRow?
    fun upsert(row: FeatureFlagRow)
    fun list(): List<FeatureFlagRow>
}

sealed class SetFeatureFlagResult {
    data class Set(val row: FeatureFlagRow) : SetFeatureFlagResult()
    data class Rejected(val problem: ApiProblem) : SetFeatureFlagResult()
}

/** `PUT /admin/feature-flags/{key}`. Idempotent upsert -- toggles the flag in place, no `row_version`. */
fun setFeatureFlag(key: String, enabled: Boolean?, actorRef: String, store: FeatureFlagStore, nowIso: String, instance: String): SetFeatureFlagResult {
    if (key.isEmpty()) {
        return SetFeatureFlagResult.Rejected(schemaValidationError("Missing required field: key", instance))
    }
    if (enabled == null) {
        return SetFeatureFlagResult.Rejected(schemaValidationError("Missing required field: enabled", instance))
    }

    val row = FeatureFlagRow(key = key, enabled = enabled, updatedAt = nowIso, updatedBy = actorRef)
    store.upsert(row)
    return SetFeatureFlagResult.Set(row)
}

/** `GET /admin/feature-flags/{key}`. Never rejects -- a flag never explicitly created defaults to disabled. */
fun getFeatureFlag(key: String, store: FeatureFlagStore): FeatureFlagRow =
    store.get(key) ?: FeatureFlagRow(key = key, enabled = false, updatedAt = "", updatedBy = "")

/** `GET /admin/feature-flags`. Every flag that has ever been explicitly set -- no pagination. */
fun listFeatureFlags(store: FeatureFlagStore): List<FeatureFlagRow> = store.list()

/** An in-memory FeatureFlagStore for tests -- not a production adapter. */
class InMemoryFeatureFlagStore : FeatureFlagStore {
    private val rows = mutableMapOf<String, FeatureFlagRow>()

    override fun get(key: String): FeatureFlagRow? = rows[key]
    override fun upsert(row: FeatureFlagRow) { rows[row.key] = row }
    override fun list(): List<FeatureFlagRow> = rows.values.toList()
}
