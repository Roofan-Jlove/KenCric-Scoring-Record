package com.kencric.scoring.api.matchofficials

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.businessRuleValidationError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0112: a field-for-field Kotlin port of `backend/src/commands/
 * matchOfficials.ts` (`TASK-0099`). No new research -- see that
 * module's own doc comment for the full grounding (the three-part
 * composite key including `role`; no update at all; the single
 * `OFCL-003` business rule).
 */

val VALID_MATCH_OFFICIAL_ROLES: List<String> = listOf("UMPIRE", "THIRD_UMPIRE", "REFEREE", "HEAD_SCORER", "ASSISTANT_SCORER")

enum class MatchOfficialRole { UMPIRE, THIRD_UMPIRE, REFEREE, HEAD_SCORER, ASSISTANT_SCORER }

data class MatchOfficialRow(
    val matchId: String,
    val officialId: String,
    val role: MatchOfficialRole,
    val createdAt: String,
    val createdBy: String,
)

interface MatchOfficialStore {
    fun get(matchId: String, officialId: String, role: String): MatchOfficialRow?
    fun upsert(row: MatchOfficialRow)
    fun remove(matchId: String, officialId: String, role: String)
    fun listByMatch(matchId: String): List<MatchOfficialRow>
}

sealed class AddMatchOfficialResult {
    data class Added(val row: MatchOfficialRow) : AddMatchOfficialResult()
    data class Rejected(val problem: ApiProblem) : AddMatchOfficialResult()
}

/** `PUT /matches/{matchId}/officials/{officialId}` (`role` supplied
 * alongside). Idempotent upsert of the exact triple -- never a
 * stale-version rejection; rejected only if this would create a
 * second `HEAD_SCORER` on the same match (`OFCL-003`). */
fun addMatchOfficial(
    matchId: String,
    officialId: String,
    role: String,
    store: MatchOfficialStore,
    actorRef: String,
    nowIso: String,
    instance: String,
): AddMatchOfficialResult {
    if (matchId.isEmpty()) return AddMatchOfficialResult.Rejected(schemaValidationError("Missing required field: matchId", instance))
    if (officialId.isEmpty()) return AddMatchOfficialResult.Rejected(schemaValidationError("Missing required field: officialId", instance))
    if (!VALID_MATCH_OFFICIAL_ROLES.contains(role)) {
        return AddMatchOfficialResult.Rejected(schemaValidationError("role must be one of ${VALID_MATCH_OFFICIAL_ROLES.joinToString(", ")}", instance))
    }

    val existing = store.get(matchId, officialId, role)

    if (existing == null && role == "HEAD_SCORER") {
        val alreadyHasHead = store.listByMatch(matchId).any { it.role == MatchOfficialRole.HEAD_SCORER }
        if (alreadyHasHead) {
            return AddMatchOfficialResult.Rejected(businessRuleValidationError("A match may have exactly one HEAD_SCORER (OFCL-003)", instance))
        }
    }

    val row = existing ?: MatchOfficialRow(
        matchId = matchId,
        officialId = officialId,
        role = MatchOfficialRole.valueOf(role),
        createdAt = nowIso,
        createdBy = actorRef,
    )

    store.upsert(row)
    return AddMatchOfficialResult.Added(row)
}

sealed class GetMatchOfficialResult {
    data class Found(val row: MatchOfficialRow) : GetMatchOfficialResult()
    data class Rejected(val problem: ApiProblem) : GetMatchOfficialResult()
}

fun getMatchOfficial(matchId: String, officialId: String, role: String, store: MatchOfficialStore, instance: String): GetMatchOfficialResult {
    val row = store.get(matchId, officialId, role)
        ?: return GetMatchOfficialResult.Rejected(notFoundError("No match official visible for match $matchId, official $officialId, role $role", instance))
    return GetMatchOfficialResult.Found(row)
}

/** `GET /matches/{matchId}/officials`. A match's officiating panel is
 * small by nature -- no keyset-pagination envelope. */
fun listMatchOfficials(matchId: String, store: MatchOfficialStore): List<MatchOfficialRow> = store.listByMatch(matchId)

sealed class RemoveMatchOfficialResult {
    data object Removed : RemoveMatchOfficialResult()
    data class Rejected(val problem: ApiProblem) : RemoveMatchOfficialResult()
}

/** `DELETE /matches/{matchId}/officials/{officialId}` (`role` supplied
 * alongside). Plain hard delete -- no gate. */
fun removeMatchOfficial(matchId: String, officialId: String, role: String, store: MatchOfficialStore, instance: String): RemoveMatchOfficialResult {
    store.get(matchId, officialId, role)
        ?: return RemoveMatchOfficialResult.Rejected(notFoundError("No match official visible for match $matchId, official $officialId, role $role", instance))
    store.remove(matchId, officialId, role)
    return RemoveMatchOfficialResult.Removed
}

private fun compositeKey(matchId: String, officialId: String, role: String): String = "$matchId::$officialId::$role"

/** An in-memory MatchOfficialStore for tests -- not a production adapter. */
class InMemoryMatchOfficialStore : MatchOfficialStore {
    private val rows = mutableMapOf<String, MatchOfficialRow>()

    override fun get(matchId: String, officialId: String, role: String): MatchOfficialRow? = rows[compositeKey(matchId, officialId, role)]
    override fun upsert(row: MatchOfficialRow) { rows[compositeKey(row.matchId, row.officialId, row.role.name)] = row }
    override fun remove(matchId: String, officialId: String, role: String) { rows.remove(compositeKey(matchId, officialId, role)) }
    override fun listByMatch(matchId: String): List<MatchOfficialRow> = rows.values.filter { it.matchId == matchId }
}
