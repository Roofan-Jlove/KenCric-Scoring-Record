package com.kencric.scoring.api.squadmembers

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0110: a field-for-field Kotlin port of `backend/src/commands/
 * squadMembers.ts` (`TASK-0097`). No new research -- see that
 * module's own doc comment for the full grounding (no `id`/
 * `row_version` at all, composite PK, idempotent upsert, plain
 * ungated hard delete).
 */

data class SquadMemberRow(
    val teamId: String,
    val playerId: String,
    val roleHint: String?,
    val createdAt: String,
    val createdBy: String,
)

interface SquadMemberStore {
    fun get(teamId: String, playerId: String): SquadMemberRow?
    fun upsert(row: SquadMemberRow)
    fun remove(teamId: String, playerId: String)
    /** Every squad member of one team -- the path's own implicit filter. */
    fun listByTeam(teamId: String): List<SquadMemberRow>
}

sealed class AddSquadMemberResult {
    data class Added(val row: SquadMemberRow) : AddSquadMemberResult()
    data class Rejected(val problem: ApiProblem) : AddSquadMemberResult()
}

/** `PUT /teams/{teamId}/squad-members/{playerId}`. Idempotent upsert
 * -- no `row_version`, never a `409`. An existing pair keeps its
 * original `createdAt`/`createdBy`; only `roleHint` is replaced. */
fun addSquadMember(
    teamId: String,
    playerId: String,
    roleHint: String?,
    store: SquadMemberStore,
    actorRef: String,
    nowIso: String,
    instance: String,
): AddSquadMemberResult {
    if (teamId.isEmpty()) return AddSquadMemberResult.Rejected(schemaValidationError("Missing required field: teamId", instance))
    if (playerId.isEmpty()) return AddSquadMemberResult.Rejected(schemaValidationError("Missing required field: playerId", instance))

    val existing = store.get(teamId, playerId)

    val row = existing?.copy(roleHint = roleHint) ?: SquadMemberRow(
        teamId = teamId,
        playerId = playerId,
        roleHint = roleHint,
        createdAt = nowIso,
        createdBy = actorRef,
    )

    store.upsert(row)
    return AddSquadMemberResult.Added(row)
}

sealed class GetSquadMemberResult {
    data class Found(val row: SquadMemberRow) : GetSquadMemberResult()
    data class Rejected(val problem: ApiProblem) : GetSquadMemberResult()
}

fun getSquadMember(teamId: String, playerId: String, store: SquadMemberStore, instance: String): GetSquadMemberResult {
    val row = store.get(teamId, playerId)
        ?: return GetSquadMemberResult.Rejected(notFoundError("No squad member visible for team $teamId, player $playerId", instance))
    return GetSquadMemberResult.Found(row)
}

/** `GET /teams/{teamId}/squad-members`. A squad is small by nature --
 * no keyset-pagination envelope, a deliberate simplification. */
fun listSquadMembers(teamId: String, store: SquadMemberStore): List<SquadMemberRow> = store.listByTeam(teamId)

sealed class RemoveSquadMemberResult {
    data object Removed : RemoveSquadMemberResult()
    data class Rejected(val problem: ApiProblem) : RemoveSquadMemberResult()
}

/** `DELETE /teams/{teamId}/squad-members/{playerId}`. Plain hard
 * delete -- no gate. */
fun removeSquadMember(teamId: String, playerId: String, store: SquadMemberStore, instance: String): RemoveSquadMemberResult {
    store.get(teamId, playerId)
        ?: return RemoveSquadMemberResult.Rejected(notFoundError("No squad member visible for team $teamId, player $playerId", instance))
    store.remove(teamId, playerId)
    return RemoveSquadMemberResult.Removed
}

private fun compositeKey(teamId: String, playerId: String): String = "$teamId::$playerId"

/** An in-memory SquadMemberStore for tests -- not a production adapter. */
class InMemorySquadMemberStore : SquadMemberStore {
    private val rows = mutableMapOf<String, SquadMemberRow>()

    override fun get(teamId: String, playerId: String): SquadMemberRow? = rows[compositeKey(teamId, playerId)]
    override fun upsert(row: SquadMemberRow) { rows[compositeKey(row.teamId, row.playerId)] = row }
    override fun remove(teamId: String, playerId: String) { rows.remove(compositeKey(teamId, playerId)) }
    override fun listByTeam(teamId: String): List<SquadMemberRow> = rows.values.filter { it.teamId == teamId }
}
