package com.kencric.scoring.api.memberships

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.businessRuleValidationError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError
import com.kencric.scoring.api.errors.staleVersionError

/**
 * TASK-0108: a field-for-field Kotlin port of `backend/src/commands/
 * memberships.ts` (`TASK-0095`). No new research -- see that module's
 * own doc comment for the full grounding (`status`/`DELETE`
 * structurally excluded, owned by `§11.3`'s own `deactivateMember`;
 * the 12-role validation; the `UQ(user_id, organization_id)` check).
 */

val VALID_ROLES: List<String> = listOf(
    "PLATFORM_ADMIN",
    "ORGANIZATION_ADMIN",
    "COMPETITION_ORGANIZER",
    "TEAM_MANAGER",
    "HEAD_SCORER",
    "ASSISTANT_SCORER",
    "UMPIRE",
    "COMMENTATOR",
    "STATISTICIAN",
    "PLAYER",
    "VIEWER",
    "GUEST",
)

data class CreateMembershipPayload(
    val id: String,
    val userId: String,
    val organizationId: String,
    val roles: List<String>? = null,
)

enum class MembershipStatus { ACTIVE, DEACTIVATED }

data class MembershipRow(
    val id: String,
    val userId: String,
    val organizationId: String,
    val roles: List<String>,
    val status: MembershipStatus,
    val rowVersion: Int,
    val createdAt: String,
    val createdBy: String,
    val updatedAt: String,
    val updatedBy: String,
)

interface MembershipStore {
    fun get(id: String): MembershipRow?
    fun insert(row: MembershipRow)
    fun update(row: MembershipRow)
    fun list(): List<MembershipRow>
    /** Backs the `UQ(user_id, organization_id)` constraint (§3.3). */
    fun findByUserAndOrg(userId: String, organizationId: String): MembershipRow?
}

fun validateMembershipSchema(id: String?, userId: String?, organizationId: String?, instance: String): ApiProblem? {
    if (id.isNullOrEmpty()) return schemaValidationError("Missing required field: id", instance)
    if (userId.isNullOrEmpty()) return schemaValidationError("Missing required field: userId", instance)
    if (organizationId.isNullOrEmpty()) return schemaValidationError("Missing required field: organizationId", instance)
    return null
}

/** §4.1 business-rule layer: every entry of `roles`, if present, must
 * be one of the 12 roles. 422 on failure. */
fun validateRoles(roles: List<String>?, instance: String): ApiProblem? {
    if (roles == null) return null
    for (role in roles) {
        if (!VALID_ROLES.contains(role)) {
            return businessRuleValidationError("Invalid role: $role -- must be one of ${VALID_ROLES.joinToString(", ")}", instance)
        }
    }
    return null
}

sealed class CreateMembershipResult {
    data class Created(val row: MembershipRow) : CreateMembershipResult()
    data class Rejected(val problem: ApiProblem) : CreateMembershipResult()
}

fun createMembership(
    payload: CreateMembershipPayload,
    store: MembershipStore,
    actorRef: String,
    nowIso: String,
    instance: String,
): CreateMembershipResult {
    val schemaProblem = validateMembershipSchema(payload.id, payload.userId, payload.organizationId, instance)
    if (schemaProblem != null) return CreateMembershipResult.Rejected(schemaProblem)

    val rolesProblem = validateRoles(payload.roles, instance)
    if (rolesProblem != null) return CreateMembershipResult.Rejected(rolesProblem)

    if (store.get(payload.id) != null) {
        return CreateMembershipResult.Rejected(
            schemaValidationError("A membership with id ${payload.id} already exists -- use the update path, not create", instance),
        )
    }

    if (store.findByUserAndOrg(payload.userId, payload.organizationId) != null) {
        return CreateMembershipResult.Rejected(
            businessRuleValidationError(
                "A membership already exists for user ${payload.userId} in organization ${payload.organizationId}",
                instance,
            ),
        )
    }

    val row = MembershipRow(
        id = payload.id,
        userId = payload.userId,
        organizationId = payload.organizationId,
        roles = payload.roles ?: emptyList(),
        status = MembershipStatus.ACTIVE,
        rowVersion = 1,
        createdAt = nowIso,
        createdBy = actorRef,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.insert(row)
    return CreateMembershipResult.Created(row)
}

/** `rolesSet` distinguishes "roles explicitly provided" from "not
 * provided at all" -- same `xSet` idiom `teams.ts`'s own Kotlin port
 * (`TASK-0107`) established. `rowVersion` nullable for the same
 * missing-field reason as every prior port. */
data class UpdateMembershipPayload(
    val rowVersion: Int? = null,
    val roles: List<String>? = null,
    val rolesSet: Boolean = false,
)

sealed class UpdateMembershipResult {
    data class Updated(val row: MembershipRow) : UpdateMembershipResult()
    data class Rejected(val problem: ApiProblem) : UpdateMembershipResult()
}

fun updateMembership(
    id: String,
    payload: UpdateMembershipPayload,
    store: MembershipStore,
    actorRef: String,
    nowIso: String,
    instance: String,
): UpdateMembershipResult {
    val existing = store.get(id) ?: return UpdateMembershipResult.Rejected(notFoundError("No membership visible with id $id", instance))

    if (payload.rowVersion == null) {
        return UpdateMembershipResult.Rejected(schemaValidationError("Missing required field: rowVersion", instance))
    }

    if (payload.rowVersion != existing.rowVersion) {
        return UpdateMembershipResult.Rejected(staleVersionError("expected row_version ${existing.rowVersion}, got ${payload.rowVersion}", instance))
    }

    val rolesProblem = if (payload.rolesSet) validateRoles(payload.roles, instance) else null
    if (rolesProblem != null) return UpdateMembershipResult.Rejected(rolesProblem)

    val updatedRow = existing.copy(
        roles = if (payload.rolesSet) (payload.roles ?: emptyList()) else existing.roles,
        rowVersion = existing.rowVersion + 1,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.update(updatedRow)
    return UpdateMembershipResult.Updated(updatedRow)
}

sealed class GetMembershipResult {
    data class Found(val row: MembershipRow) : GetMembershipResult()
    data class Rejected(val problem: ApiProblem) : GetMembershipResult()
}

fun getMembership(id: String, store: MembershipStore, instance: String): GetMembershipResult {
    val row = store.get(id) ?: return GetMembershipResult.Rejected(notFoundError("No membership visible with id $id", instance))
    return GetMembershipResult.Found(row)
}

data class ListMembershipsQuery(
    val after: String? = null,
    val limit: Int? = null,
    val organizationId: String? = null,
    val userId: String? = null,
    val status: MembershipStatus? = null,
)

data class ListMembershipsResult(
    val items: List<MembershipRow>,
    val nextCursor: String?,
    val hasMore: Boolean,
)

private const val DEFAULT_LIMIT = 50
private const val MAX_LIMIT = 200

fun listMemberships(query: ListMembershipsQuery, store: MembershipStore): ListMembershipsResult {
    val limit = minOf(query.limit ?: DEFAULT_LIMIT, MAX_LIMIT)

    var rows = store.list().sortedBy { it.id }

    if (query.organizationId != null) {
        rows = rows.filter { it.organizationId == query.organizationId }
    }

    if (query.userId != null) {
        rows = rows.filter { it.userId == query.userId }
    }

    if (query.status != null) {
        rows = rows.filter { it.status == query.status }
    }

    if (!query.after.isNullOrEmpty()) {
        val cursor = query.after
        rows = rows.filter { it.id > cursor }
    }

    val page = rows.take(limit)
    val hasMore = rows.size > limit
    val nextCursor = if (hasMore) page.last().id else null

    return ListMembershipsResult(items = page, nextCursor = nextCursor, hasMore = hasMore)
}

/** An in-memory MembershipStore for tests -- not a production adapter. */
class InMemoryMembershipStore : MembershipStore {
    private val rows = mutableMapOf<String, MembershipRow>()

    override fun get(id: String): MembershipRow? = rows[id]
    override fun insert(row: MembershipRow) { rows[row.id] = row }
    override fun update(row: MembershipRow) { rows[row.id] = row }
    override fun list(): List<MembershipRow> = rows.values.toList()

    override fun findByUserAndOrg(userId: String, organizationId: String): MembershipRow? =
        rows.values.firstOrNull { it.userId == userId && it.organizationId == organizationId }
}
