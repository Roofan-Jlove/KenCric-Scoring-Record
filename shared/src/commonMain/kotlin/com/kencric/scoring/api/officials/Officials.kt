package com.kencric.scoring.api.officials

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.businessRuleValidationError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError
import com.kencric.scoring.api.errors.staleVersionError

/**
 * TASK-0111: a field-for-field Kotlin port of `backend/src/commands/
 * officials.ts` (`TASK-0098`). No new research -- see that module's
 * own doc comment for the full grounding (the one-gate `deleteOfficial`,
 * unlike `teams`' two-gate; the `organizationId`-not-`matchId`
 * filterable-fields correction).
 */

data class CreateOfficialPayload(
    val id: String,
    val name: String,
    val organizationId: String? = null,
    val userId: String? = null,
)

data class OfficialRow(
    val id: String,
    val organizationId: String?,
    val userId: String?,
    val name: String,
    val rowVersion: Int,
    val createdAt: String,
    val createdBy: String,
    val updatedAt: String,
    val updatedBy: String,
)

interface OfficialStore {
    fun get(id: String): OfficialRow?
    fun insert(row: OfficialRow)
    fun update(row: OfficialRow)
    fun remove(id: String)
    fun list(): List<OfficialRow>
    /** A real adapter queries `match_officials` for any historical
     * assignment; the in-memory test store below exposes a settable
     * marker instead. */
    fun hasMatchAssignment(id: String): Boolean
}

fun validateOfficialSchema(id: String?, name: String?, instance: String): ApiProblem? {
    if (id.isNullOrEmpty()) return schemaValidationError("Missing required field: id", instance)
    if (name.isNullOrEmpty()) return schemaValidationError("Missing required field: name", instance)
    return null
}

sealed class CreateOfficialResult {
    data class Created(val row: OfficialRow) : CreateOfficialResult()
    data class Rejected(val problem: ApiProblem) : CreateOfficialResult()
}

fun createOfficial(payload: CreateOfficialPayload, store: OfficialStore, actorRef: String, nowIso: String, instance: String): CreateOfficialResult {
    val schemaProblem = validateOfficialSchema(payload.id, payload.name, instance)
    if (schemaProblem != null) return CreateOfficialResult.Rejected(schemaProblem)

    if (store.get(payload.id) != null) {
        return CreateOfficialResult.Rejected(
            schemaValidationError("An official with id ${payload.id} already exists -- use the update path, not create", instance),
        )
    }

    val row = OfficialRow(
        id = payload.id,
        organizationId = payload.organizationId,
        userId = payload.userId,
        name = payload.name,
        rowVersion = 1,
        createdAt = nowIso,
        createdBy = actorRef,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.insert(row)
    return CreateOfficialResult.Created(row)
}

/** `xSet` companion flags per nullable-updatable field, same idiom
 * `teams.ts`'s own Kotlin port (`TASK-0107`) established. */
data class UpdateOfficialPayload(
    val rowVersion: Int? = null,
    val organizationId: String? = null,
    val organizationIdSet: Boolean = false,
    val userId: String? = null,
    val userIdSet: Boolean = false,
    val name: String? = null,
)

sealed class UpdateOfficialResult {
    data class Updated(val row: OfficialRow) : UpdateOfficialResult()
    data class Rejected(val problem: ApiProblem) : UpdateOfficialResult()
}

fun updateOfficial(id: String, payload: UpdateOfficialPayload, store: OfficialStore, actorRef: String, nowIso: String, instance: String): UpdateOfficialResult {
    val existing = store.get(id) ?: return UpdateOfficialResult.Rejected(notFoundError("No official visible with id $id", instance))

    if (payload.rowVersion == null) {
        return UpdateOfficialResult.Rejected(schemaValidationError("Missing required field: rowVersion", instance))
    }

    if (payload.rowVersion != existing.rowVersion) {
        return UpdateOfficialResult.Rejected(staleVersionError("expected row_version ${existing.rowVersion}, got ${payload.rowVersion}", instance))
    }

    if (payload.name != null && payload.name.isEmpty()) {
        return UpdateOfficialResult.Rejected(schemaValidationError("name must not be empty", instance))
    }

    val updatedRow = existing.copy(
        organizationId = if (payload.organizationIdSet) payload.organizationId else existing.organizationId,
        userId = if (payload.userIdSet) payload.userId else existing.userId,
        name = payload.name ?: existing.name,
        rowVersion = existing.rowVersion + 1,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.update(updatedRow)
    return UpdateOfficialResult.Updated(updatedRow)
}

sealed class GetOfficialResult {
    data class Found(val row: OfficialRow) : GetOfficialResult()
    data class Rejected(val problem: ApiProblem) : GetOfficialResult()
}

fun getOfficial(id: String, store: OfficialStore, instance: String): GetOfficialResult {
    val row = store.get(id) ?: return GetOfficialResult.Rejected(notFoundError("No official visible with id $id", instance))
    return GetOfficialResult.Found(row)
}

data class ListOfficialsQuery(
    val after: String? = null,
    val limit: Int? = null,
    val organizationId: String? = null,
)

data class ListOfficialsResult(
    val items: List<OfficialRow>,
    val nextCursor: String?,
    val hasMore: Boolean,
)

private const val DEFAULT_LIMIT = 50
private const val MAX_LIMIT = 200

fun listOfficials(query: ListOfficialsQuery, store: OfficialStore): ListOfficialsResult {
    val limit = minOf(query.limit ?: DEFAULT_LIMIT, MAX_LIMIT)

    var rows = store.list().sortedBy { it.id }

    if (query.organizationId != null) {
        rows = rows.filter { it.organizationId == query.organizationId }
    }

    if (!query.after.isNullOrEmpty()) {
        val cursor = query.after
        rows = rows.filter { it.id > cursor }
    }

    val page = rows.take(limit)
    val hasMore = rows.size > limit
    val nextCursor = if (hasMore) page.last().id else null

    return ListOfficialsResult(items = page, nextCursor = nextCursor, hasMore = hasMore)
}

sealed class DeleteOfficialResult {
    data object Deleted : DeleteOfficialResult()
    data class Rejected(val problem: ApiProblem) : DeleteOfficialResult()
}

/** `DELETE /officials/{id}`. One gate: existence, then match-
 * assignment (`422`). No authorship restriction, unlike `teams`'. */
fun deleteOfficial(id: String, store: OfficialStore, instance: String): DeleteOfficialResult {
    store.get(id) ?: return DeleteOfficialResult.Rejected(notFoundError("No official visible with id $id", instance))

    if (store.hasMatchAssignment(id)) {
        return DeleteOfficialResult.Rejected(businessRuleValidationError("An official with a match assignment is never deleted", instance))
    }

    store.remove(id)
    return DeleteOfficialResult.Deleted
}

/** An in-memory OfficialStore for tests -- not a production adapter. */
class InMemoryOfficialStore : OfficialStore {
    private val rows = mutableMapOf<String, OfficialRow>()
    private val assignedOfficialIds = mutableSetOf<String>()

    override fun get(id: String): OfficialRow? = rows[id]
    override fun insert(row: OfficialRow) { rows[row.id] = row }
    override fun update(row: OfficialRow) { rows[row.id] = row }
    override fun remove(id: String) { rows.remove(id) }
    override fun list(): List<OfficialRow> = rows.values.toList()
    override fun hasMatchAssignment(id: String): Boolean = assignedOfficialIds.contains(id)

    /** Test-only helper -- marks an official as having a match
     * assignment. */
    fun markHasMatchAssignment(id: String) { assignedOfficialIds.add(id) }
}
