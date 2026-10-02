package com.kencric.scoring.api.teams

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.authForbidden
import com.kencric.scoring.api.errors.businessRuleValidationError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError
import com.kencric.scoring.api.errors.staleVersionError

/**
 * TASK-0107: a field-for-field Kotlin port of `backend/src/commands/
 * teams.ts` (`TASK-0094`). No new research -- see that module's own
 * doc comment for the full grounding (the two-gate `deleteTeam`:
 * match-history then authorship).
 */

data class CreateTeamPayload(
    val id: String,
    val name: String,
    val organizationId: String? = null,
    val canonicalRef: String? = null,
)

data class TeamRow(
    val id: String,
    val organizationId: String?,
    val name: String,
    val canonicalRef: String?,
    val rowVersion: Int,
    val createdAt: String,
    val createdBy: String,
    val updatedAt: String,
    val updatedBy: String,
)

interface TeamStore {
    fun get(id: String): TeamRow?
    fun insert(row: TeamRow)
    fun update(row: TeamRow)
    fun remove(id: String)
    fun list(): List<TeamRow>
    /** A real adapter queries `matches`/`squad_members` for any
     * historical reference; the in-memory test store below exposes a
     * settable marker instead. */
    fun hasMatchHistory(id: String): Boolean
}

fun validateTeamSchema(id: String?, name: String?, instance: String): ApiProblem? {
    if (id.isNullOrEmpty()) return schemaValidationError("Missing required field: id", instance)
    if (name.isNullOrEmpty()) return schemaValidationError("Missing required field: name", instance)
    return null
}

sealed class CreateTeamResult {
    data class Created(val row: TeamRow) : CreateTeamResult()
    data class Rejected(val problem: ApiProblem) : CreateTeamResult()
}

fun createTeam(payload: CreateTeamPayload, store: TeamStore, actorRef: String, nowIso: String, instance: String): CreateTeamResult {
    val schemaProblem = validateTeamSchema(payload.id, payload.name, instance)
    if (schemaProblem != null) return CreateTeamResult.Rejected(schemaProblem)

    if (store.get(payload.id) != null) {
        return CreateTeamResult.Rejected(
            schemaValidationError("A team with id ${payload.id} already exists -- use the update path, not create", instance),
        )
    }

    val row = TeamRow(
        id = payload.id,
        organizationId = payload.organizationId,
        name = payload.name,
        canonicalRef = payload.canonicalRef,
        rowVersion = 1,
        createdAt = nowIso,
        createdBy = actorRef,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.insert(row)
    return CreateTeamResult.Created(row)
}

/** `rowVersion` is nullable to honestly represent a missing field --
 * same reasoning as `organizations.ts`'s own Kotlin port (`TASK-0106`). */
data class UpdateTeamPayload(
    val rowVersion: Int? = null,
    val organizationId: String? = null,
    val organizationIdSet: Boolean = false,
    val name: String? = null,
    val canonicalRef: String? = null,
    val canonicalRefSet: Boolean = false,
)

sealed class UpdateTeamResult {
    data class Updated(val row: TeamRow) : UpdateTeamResult()
    data class Rejected(val problem: ApiProblem) : UpdateTeamResult()
}

fun updateTeam(id: String, payload: UpdateTeamPayload, store: TeamStore, actorRef: String, nowIso: String, instance: String): UpdateTeamResult {
    val existing = store.get(id) ?: return UpdateTeamResult.Rejected(notFoundError("No team visible with id $id", instance))

    if (payload.rowVersion == null) {
        return UpdateTeamResult.Rejected(schemaValidationError("Missing required field: rowVersion", instance))
    }

    if (payload.rowVersion != existing.rowVersion) {
        return UpdateTeamResult.Rejected(staleVersionError("expected row_version ${existing.rowVersion}, got ${payload.rowVersion}", instance))
    }

    if (payload.name != null && payload.name.isEmpty()) {
        return UpdateTeamResult.Rejected(schemaValidationError("name must not be empty", instance))
    }

    val updatedRow = existing.copy(
        organizationId = if (payload.organizationIdSet) payload.organizationId else existing.organizationId,
        name = payload.name ?: existing.name,
        canonicalRef = if (payload.canonicalRefSet) payload.canonicalRef else existing.canonicalRef,
        rowVersion = existing.rowVersion + 1,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.update(updatedRow)
    return UpdateTeamResult.Updated(updatedRow)
}

sealed class GetTeamResult {
    data class Found(val row: TeamRow) : GetTeamResult()
    data class Rejected(val problem: ApiProblem) : GetTeamResult()
}

fun getTeam(id: String, store: TeamStore, instance: String): GetTeamResult {
    val row = store.get(id) ?: return GetTeamResult.Rejected(notFoundError("No team visible with id $id", instance))
    return GetTeamResult.Found(row)
}

data class ListTeamsQuery(
    val after: String? = null,
    val limit: Int? = null,
    val organizationId: String? = null,
    val nameSearch: String? = null,
)

data class ListTeamsResult(
    val items: List<TeamRow>,
    val nextCursor: String?,
    val hasMore: Boolean,
)

private const val DEFAULT_LIMIT = 50
private const val MAX_LIMIT = 200

fun listTeams(query: ListTeamsQuery, store: TeamStore): ListTeamsResult {
    val limit = minOf(query.limit ?: DEFAULT_LIMIT, MAX_LIMIT)

    var rows = store.list().sortedBy { it.id }

    if (query.organizationId != null) {
        rows = rows.filter { it.organizationId == query.organizationId }
    }

    if (!query.nameSearch.isNullOrEmpty()) {
        val needle = query.nameSearch.lowercase()
        rows = rows.filter { it.name.lowercase().contains(needle) }
    }

    if (!query.after.isNullOrEmpty()) {
        val cursor = query.after
        rows = rows.filter { it.id > cursor }
    }

    val page = rows.take(limit)
    val hasMore = rows.size > limit
    val nextCursor = if (hasMore) page.last().id else null

    return ListTeamsResult(items = page, nextCursor = nextCursor, hasMore = hasMore)
}

sealed class DeleteTeamResult {
    data object Deleted : DeleteTeamResult()
    data class Rejected(val problem: ApiProblem) : DeleteTeamResult()
}

/** `DELETE /teams/{id}`. Two gates in order: existence, then match-
 * history (`422`), then authorship (`403`). */
fun deleteTeam(id: String, store: TeamStore, actorRef: String, instance: String): DeleteTeamResult {
    val existing = store.get(id) ?: return DeleteTeamResult.Rejected(notFoundError("No team visible with id $id", instance))

    if (store.hasMatchHistory(id)) {
        return DeleteTeamResult.Rejected(businessRuleValidationError("A team with match history is never deleted", instance))
    }

    if (existing.createdBy != actorRef) {
        return DeleteTeamResult.Rejected(authForbidden("Only this team's own creator may delete it", instance))
    }

    store.remove(id)
    return DeleteTeamResult.Deleted
}

/** An in-memory TeamStore for tests -- not a production adapter. */
class InMemoryTeamStore : TeamStore {
    private val rows = mutableMapOf<String, TeamRow>()
    private val matchHistoryTeamIds = mutableSetOf<String>()

    override fun get(id: String): TeamRow? = rows[id]
    override fun insert(row: TeamRow) { rows[row.id] = row }
    override fun update(row: TeamRow) { rows[row.id] = row }
    override fun remove(id: String) { rows.remove(id) }
    override fun list(): List<TeamRow> = rows.values.toList()
    override fun hasMatchHistory(id: String): Boolean = matchHistoryTeamIds.contains(id)

    /** Test-only helper -- marks a team as having match history. */
    fun markHasMatchHistory(id: String) { matchHistoryTeamIds.add(id) }
}
