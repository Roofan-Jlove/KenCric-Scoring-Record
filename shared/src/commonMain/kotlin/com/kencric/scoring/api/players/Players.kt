package com.kencric.scoring.api.players

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError
import com.kencric.scoring.api.errors.staleVersionError

/**
 * TASK-0109: a field-for-field Kotlin port of `backend/src/commands/
 * players.ts` (`TASK-0096`). No new research -- see that module's own
 * doc comment for the full grounding (`status`/`mergedIntoPlayerId`
 * structurally absent, owned by `§11.6`'s own future merge command;
 * `dob` stored with no redaction logic, `NFR-039` not MVP scope).
 */

data class CreatePlayerPayload(
    val id: String,
    val name: String,
    val organizationId: String? = null,
    val dob: String? = null,
    val photoRef: String? = null,
)

enum class PlayerStatus { ACTIVE, MERGED }

data class PlayerRow(
    val id: String,
    val organizationId: String?,
    val name: String,
    val dob: String?,
    val photoRef: String?,
    val status: PlayerStatus,
    val mergedIntoPlayerId: String?,
    val rowVersion: Int,
    val createdAt: String,
    val createdBy: String,
    val updatedAt: String,
    val updatedBy: String,
)

interface PlayerStore {
    fun get(id: String): PlayerRow?
    fun insert(row: PlayerRow)
    fun update(row: PlayerRow)
    fun list(): List<PlayerRow>
}

fun validatePlayerSchema(id: String?, name: String?, instance: String): ApiProblem? {
    if (id.isNullOrEmpty()) return schemaValidationError("Missing required field: id", instance)
    if (name.isNullOrEmpty()) return schemaValidationError("Missing required field: name", instance)
    return null
}

sealed class CreatePlayerResult {
    data class Created(val row: PlayerRow) : CreatePlayerResult()
    data class Rejected(val problem: ApiProblem) : CreatePlayerResult()
}

fun createPlayer(payload: CreatePlayerPayload, store: PlayerStore, actorRef: String, nowIso: String, instance: String): CreatePlayerResult {
    val schemaProblem = validatePlayerSchema(payload.id, payload.name, instance)
    if (schemaProblem != null) return CreatePlayerResult.Rejected(schemaProblem)

    if (store.get(payload.id) != null) {
        return CreatePlayerResult.Rejected(
            schemaValidationError("A player with id ${payload.id} already exists -- use the update path, not create", instance),
        )
    }

    val row = PlayerRow(
        id = payload.id,
        organizationId = payload.organizationId,
        name = payload.name,
        dob = payload.dob,
        photoRef = payload.photoRef,
        status = PlayerStatus.ACTIVE,
        mergedIntoPlayerId = null,
        rowVersion = 1,
        createdAt = nowIso,
        createdBy = actorRef,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.insert(row)
    return CreatePlayerResult.Created(row)
}

/** `xSet` companion flags distinguish "explicitly provided" from "not
 * provided" per nullable-updatable field, same idiom `teams.ts`'s own
 * Kotlin port (`TASK-0107`) established. `rowVersion` nullable for the
 * same missing-field reason as every prior port. `status`/
 * `mergedIntoPlayerId` have no fields here at all -- structurally
 * unsettable, matching the TS payload's own exclusion exactly. */
data class UpdatePlayerPayload(
    val rowVersion: Int? = null,
    val organizationId: String? = null,
    val organizationIdSet: Boolean = false,
    val name: String? = null,
    val dob: String? = null,
    val dobSet: Boolean = false,
    val photoRef: String? = null,
    val photoRefSet: Boolean = false,
)

sealed class UpdatePlayerResult {
    data class Updated(val row: PlayerRow) : UpdatePlayerResult()
    data class Rejected(val problem: ApiProblem) : UpdatePlayerResult()
}

fun updatePlayer(id: String, payload: UpdatePlayerPayload, store: PlayerStore, actorRef: String, nowIso: String, instance: String): UpdatePlayerResult {
    val existing = store.get(id) ?: return UpdatePlayerResult.Rejected(notFoundError("No player visible with id $id", instance))

    if (payload.rowVersion == null) {
        return UpdatePlayerResult.Rejected(schemaValidationError("Missing required field: rowVersion", instance))
    }

    if (payload.rowVersion != existing.rowVersion) {
        return UpdatePlayerResult.Rejected(staleVersionError("expected row_version ${existing.rowVersion}, got ${payload.rowVersion}", instance))
    }

    if (payload.name != null && payload.name.isEmpty()) {
        return UpdatePlayerResult.Rejected(schemaValidationError("name must not be empty", instance))
    }

    val updatedRow = existing.copy(
        organizationId = if (payload.organizationIdSet) payload.organizationId else existing.organizationId,
        name = payload.name ?: existing.name,
        dob = if (payload.dobSet) payload.dob else existing.dob,
        photoRef = if (payload.photoRefSet) payload.photoRef else existing.photoRef,
        rowVersion = existing.rowVersion + 1,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.update(updatedRow)
    return UpdatePlayerResult.Updated(updatedRow)
}

sealed class GetPlayerResult {
    data class Found(val row: PlayerRow) : GetPlayerResult()
    data class Rejected(val problem: ApiProblem) : GetPlayerResult()
}

fun getPlayer(id: String, store: PlayerStore, instance: String): GetPlayerResult {
    val row = store.get(id) ?: return GetPlayerResult.Rejected(notFoundError("No player visible with id $id", instance))
    return GetPlayerResult.Found(row)
}

data class ListPlayersQuery(
    val after: String? = null,
    val limit: Int? = null,
    val organizationId: String? = null,
    val nameSearch: String? = null,
)

data class ListPlayersResult(
    val items: List<PlayerRow>,
    val nextCursor: String?,
    val hasMore: Boolean,
)

private const val DEFAULT_LIMIT = 50
private const val MAX_LIMIT = 200

fun listPlayers(query: ListPlayersQuery, store: PlayerStore): ListPlayersResult {
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

    return ListPlayersResult(items = page, nextCursor = nextCursor, hasMore = hasMore)
}

/** An in-memory PlayerStore for tests -- not a production adapter. */
class InMemoryPlayerStore : PlayerStore {
    private val rows = mutableMapOf<String, PlayerRow>()

    override fun get(id: String): PlayerRow? = rows[id]
    override fun insert(row: PlayerRow) { rows[row.id] = row }
    override fun update(row: PlayerRow) { rows[row.id] = row }
    override fun list(): List<PlayerRow> = rows.values.toList()
}
