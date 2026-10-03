package com.kencric.scoring.api.statusbanners

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0139: a field-for-field Kotlin port of `backend/src/commands/
 * statusBanners.ts` (`TASK-0138`), the 22nd and final Android backend-
 * command port of this session. No new research -- see that module's
 * own doc comment for the full grounding (the most speculative module
 * of the entire session; `message`/`severity`/`active`/`startsAt`/
 * `endsAt` genuinely invented to fit `FR-160`'s own single phrase, not
 * derived from any written requirement detail). `getStatusBanner`
 * returns a real rejection on an unknown id -- unlike `featureFlags`'s
 * own never-rejects default, there is no sensible default banner.
 */

data class StatusBannerRow(
    val id: String,
    val message: String,
    val severity: String? = null,
    val active: Boolean,
    val startsAt: String? = null,
    val endsAt: String? = null,
    val updatedAt: String,
    val updatedBy: String,
)

interface StatusBannerStore {
    fun get(id: String): StatusBannerRow?
    fun upsert(row: StatusBannerRow)
    fun list(): List<StatusBannerRow>
}

data class SetStatusBannerPayload(
    val message: String? = null,
    val severity: String? = null,
    val active: Boolean? = null,
    val startsAt: String? = null,
    val endsAt: String? = null,
)

sealed class SetStatusBannerResult {
    data class Set(val row: StatusBannerRow) : SetStatusBannerResult()
    data class Rejected(val problem: ApiProblem) : SetStatusBannerResult()
}

/** `PUT /admin/status-banners/{id}`. Idempotent upsert -- no `row_version`. */
fun setStatusBanner(id: String, payload: SetStatusBannerPayload, actorRef: String, store: StatusBannerStore, nowIso: String, instance: String): SetStatusBannerResult {
    if (id.isEmpty()) {
        return SetStatusBannerResult.Rejected(schemaValidationError("Missing required field: id", instance))
    }
    if (payload.message.isNullOrEmpty()) {
        return SetStatusBannerResult.Rejected(schemaValidationError("Missing required field: message", instance))
    }
    if (payload.active == null) {
        return SetStatusBannerResult.Rejected(schemaValidationError("Missing required field: active", instance))
    }

    val row = StatusBannerRow(
        id = id,
        message = payload.message,
        severity = payload.severity,
        active = payload.active,
        startsAt = payload.startsAt,
        endsAt = payload.endsAt,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.upsert(row)
    return SetStatusBannerResult.Set(row)
}

sealed class GetStatusBannerResult {
    data class Found(val row: StatusBannerRow) : GetStatusBannerResult()
    data class Rejected(val problem: ApiProblem) : GetStatusBannerResult()
}

/** `GET /admin/status-banners/{id}`. A real `404` -- there is no sensible default to fall back to. */
fun getStatusBanner(id: String, store: StatusBannerStore, instance: String): GetStatusBannerResult {
    val row = store.get(id)
        ?: return GetStatusBannerResult.Rejected(notFoundError("No status banner visible with id $id", instance))
    return GetStatusBannerResult.Found(row)
}

/** `GET /admin/status-banners`. Every banner ever created, unfiltered, no pagination. */
fun listStatusBanners(store: StatusBannerStore): List<StatusBannerRow> = store.list()

/** The client-facing read: which banners should actually display right now. `active` and the `startsAt`/`endsAt` window are independent -- both must hold. */
fun listActiveStatusBanners(nowIso: String, store: StatusBannerStore): List<StatusBannerRow> =
    store.list().filter { row ->
        if (!row.active) return@filter false
        if (row.startsAt != null && nowIso < row.startsAt) return@filter false
        if (row.endsAt != null && nowIso > row.endsAt) return@filter false
        true
    }

/** An in-memory StatusBannerStore for tests -- not a production adapter. */
class InMemoryStatusBannerStore : StatusBannerStore {
    private val rows = mutableMapOf<String, StatusBannerRow>()

    override fun get(id: String): StatusBannerRow? = rows[id]
    override fun upsert(row: StatusBannerRow) { rows[row.id] = row }
    override fun list(): List<StatusBannerRow> = rows.values.toList()
}
