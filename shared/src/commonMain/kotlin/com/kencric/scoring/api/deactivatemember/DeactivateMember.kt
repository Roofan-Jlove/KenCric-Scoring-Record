package com.kencric.scoring.api.deactivatemember

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.memberships.MembershipRow
import com.kencric.scoring.api.memberships.MembershipStatus
import com.kencric.scoring.api.memberships.MembershipStore

/**
 * TASK-0114: a field-for-field Kotlin port of `backend/src/commands/
 * deactivateMember.ts` (`TASK-0101`) -- the first `§11` command port
 * in this cluster, not generic CRUD. Reuses `com.kencric.scoring.api.
 * memberships`'s own `MembershipRow`/`MembershipStore`/
 * `MembershipStatus` directly, the same cross-module reuse the TS
 * side already does. No new research -- see that module's own doc
 * comment for the full grounding (the `BR-024`→`BR-023` citation
 * finding; the Idempotency-Key mechanism; the safe no-op on an
 * already-`DEACTIVATED` membership).
 */

sealed class DeactivateMemberResult {
    data class Deactivated(val row: MembershipRow) : DeactivateMemberResult()
    data class Rejected(val problem: ApiProblem) : DeactivateMemberResult()
}

/**
 * Per-endpoint idempotency-key cache. `§8.1`'s own `[DEFAULT]`
 * 24-hour retention window is not modeled here -- the in-memory test
 * double retains indefinitely.
 */
interface IdempotencyStore {
    fun getPriorSuccess(key: String): DeactivateMemberResult?
    fun recordSuccess(key: String, result: DeactivateMemberResult)
}

/**
 * Sets a membership's `status` to `DEACTIVATED` -- never via the
 * generic update. Idempotent via `idempotencyKey`, not `rowVersion`.
 */
fun deactivateMember(
    membershipId: String,
    idempotencyKey: String,
    membershipStore: MembershipStore,
    idempotencyStore: IdempotencyStore,
    actorRef: String,
    nowIso: String,
    instance: String,
): DeactivateMemberResult {
    val priorResult = idempotencyStore.getPriorSuccess(idempotencyKey)
    if (priorResult != null) {
        return priorResult
    }

    val existing = membershipStore.get(membershipId)
        ?: return DeactivateMemberResult.Rejected(notFoundError("No membership visible with id $membershipId", instance))

    if (existing.status == MembershipStatus.DEACTIVATED) {
        val result = DeactivateMemberResult.Deactivated(existing)
        idempotencyStore.recordSuccess(idempotencyKey, result)
        return result
    }

    val updatedRow = existing.copy(
        status = MembershipStatus.DEACTIVATED,
        rowVersion = existing.rowVersion + 1,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )

    membershipStore.update(updatedRow)

    val result = DeactivateMemberResult.Deactivated(updatedRow)
    idempotencyStore.recordSuccess(idempotencyKey, result)
    return result
}

/** An in-memory IdempotencyStore for tests -- not a production adapter. */
class InMemoryIdempotencyStore : IdempotencyStore {
    private val successesByKey = mutableMapOf<String, DeactivateMemberResult>()

    override fun getPriorSuccess(key: String): DeactivateMemberResult? = successesByKey[key]
    override fun recordSuccess(key: String, result: DeactivateMemberResult) { successesByKey[key] = result }
}
