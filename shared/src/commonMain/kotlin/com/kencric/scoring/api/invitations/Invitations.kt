package com.kencric.scoring.api.invitations

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.businessRuleValidationError
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.invitationExpiredError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError
import com.kencric.scoring.api.memberships.MembershipRow
import com.kencric.scoring.api.memberships.MembershipStatus
import com.kencric.scoring.api.memberships.MembershipStore
import com.kencric.scoring.api.memberships.VALID_ROLES

/**
 * TASK-0126: a field-for-field Kotlin port of `backend/src/commands/
 * invitations.ts` (`TASK-0120`), the 14th Android backend-command port
 * -- the first of four new ports picked up after the `§6.3` cluster
 * closed, per the user's own explicit direction. No new research --
 * see that module's own doc comment for the full grounding (the
 * `410 Gone`/`invitationExpiredError` registry-gap finding; the
 * deliberate non-check on the "authenticated as the invited email"
 * authz line). Reuses `com.kencric.scoring.api.memberships`'s own
 * `MembershipRow`/`MembershipStatus`/`MembershipStore`/`VALID_ROLES`
 * directly via cross-module import, the same shape `deactivateMember`
 * already established against the same module.
 */

enum class InvitationStatus { PENDING, ACCEPTED, REVOKED }

data class InvitationRow(
    val id: String,
    val organizationId: String,
    val email: String,
    val roles: List<String>,
    val token: String,
    val status: InvitationStatus,
    val expiresAt: String,
    val invitedAt: String,
    val invitedBy: String,
    val acceptedAt: String?,
)

interface InvitationStore {
    fun get(id: String): InvitationRow?
    fun getByToken(token: String): InvitationRow?
    fun insert(row: InvitationRow)
    fun update(row: InvitationRow)
}

data class InviteMemberPayload(
    val organizationId: String? = null,
    val email: String? = null,
    val roles: List<String>? = null,
    val expiresAt: String? = null,
)

sealed class InviteMemberResult {
    data class Sent(val row: InvitationRow) : InviteMemberResult()
    data class Rejected(val problem: ApiProblem) : InviteMemberResult()
}

/** `POST /organizations/{orgId}/invitations`. Always creates a new row -- no idempotency contract stated. */
fun inviteMember(
    payload: InviteMemberPayload,
    store: InvitationStore,
    actorRef: String,
    newInvitationId: String,
    newToken: String,
    nowIso: String,
    instance: String,
): InviteMemberResult {
    if (payload.organizationId.isNullOrEmpty()) {
        return InviteMemberResult.Rejected(schemaValidationError("Missing required field: organizationId", instance))
    }
    if (payload.email.isNullOrEmpty()) {
        return InviteMemberResult.Rejected(schemaValidationError("Missing required field: email", instance))
    }
    if (payload.expiresAt.isNullOrEmpty()) {
        return InviteMemberResult.Rejected(schemaValidationError("Missing required field: expiresAt", instance))
    }

    val roles = payload.roles ?: emptyList()
    for (role in roles) {
        if (!VALID_ROLES.contains(role)) {
            return InviteMemberResult.Rejected(businessRuleValidationError("Invalid role: $role -- must be one of ${VALID_ROLES.joinToString(", ")}", instance))
        }
    }

    val row = InvitationRow(
        id = newInvitationId,
        organizationId = payload.organizationId,
        email = payload.email,
        roles = roles,
        token = newToken,
        status = InvitationStatus.PENDING,
        expiresAt = payload.expiresAt,
        invitedAt = nowIso,
        invitedBy = actorRef,
        acceptedAt = null,
    )

    store.insert(row)
    return InviteMemberResult.Sent(row)
}

sealed class AcceptInvitationResult {
    data class Accepted(val row: MembershipRow) : AcceptInvitationResult()
    data class Rejected(val problem: ApiProblem) : AcceptInvitationResult()
}

/**
 * `POST /invitations/{token}/accept`. Looks the invitation up by
 * token; `410`s if past `expiresAt`; `409`s if not `PENDING` (already
 * accepted or revoked -- a genuinely different concern from a
 * reused-token *replay*, since a token is single-use by design).
 *
 * `acceptingUserId` is the authenticated caller's real `users.id` --
 * `§11.5`'s own "authenticated as the invited email" Authz line is an
 * auth-layer check this module has no session plumbing to perform
 * itself; taken as an explicit caller-supplied input instead of
 * derived from `invitation.email` (a contact address, never a
 * `users.id`).
 */
fun acceptInvitation(
    token: String,
    acceptingUserId: String,
    invitationStore: InvitationStore,
    membershipStore: MembershipStore,
    newMembershipId: String,
    nowIso: String,
    instance: String,
): AcceptInvitationResult {
    val invitation = invitationStore.getByToken(token)
        ?: return AcceptInvitationResult.Rejected(notFoundError("No invitation visible for token $token", instance))

    if (invitation.status != InvitationStatus.PENDING) {
        return AcceptInvitationResult.Rejected(
            invalidTransitionError("Invitation ${invitation.id} is ${invitation.status}, not PENDING -- cannot accept", instance),
        )
    }

    if (invitation.expiresAt < nowIso) {
        return AcceptInvitationResult.Rejected(invitationExpiredError("Invitation ${invitation.id} expired at ${invitation.expiresAt}", instance))
    }

    val membershipRow = MembershipRow(
        id = newMembershipId,
        userId = acceptingUserId,
        organizationId = invitation.organizationId,
        roles = invitation.roles,
        status = MembershipStatus.ACTIVE,
        invitedAt = invitation.invitedAt,
        acceptedAt = nowIso,
        rowVersion = 1,
        createdAt = nowIso,
        createdBy = invitation.invitedBy,
        updatedAt = nowIso,
        updatedBy = invitation.invitedBy,
    )
    membershipStore.insert(membershipRow)

    val updatedInvitation = invitation.copy(status = InvitationStatus.ACCEPTED, acceptedAt = nowIso)
    invitationStore.update(updatedInvitation)

    return AcceptInvitationResult.Accepted(membershipRow)
}

/** An in-memory InvitationStore for tests -- not a production adapter. */
class InMemoryInvitationStore : InvitationStore {
    private val rows = mutableMapOf<String, InvitationRow>()

    override fun get(id: String): InvitationRow? = rows[id]
    override fun getByToken(token: String): InvitationRow? = rows.values.find { it.token == token }
    override fun insert(row: InvitationRow) { rows[row.id] = row }
    override fun update(row: InvitationRow) { rows[row.id] = row }
}
