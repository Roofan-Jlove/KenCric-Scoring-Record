package com.kencric.scoring.api.claimmatch

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.matches.MatchClaimStatus
import com.kencric.scoring.api.matches.MatchRow
import com.kencric.scoring.api.matches.MatchStore

/**
 * TASK-0115: a field-for-field Kotlin port of `backend/src/commands/
 * claimMatch.ts` (`TASK-0102`) -- the second `§11` command port.
 * Reuses `com.kencric.scoring.api.matches`'s own `MatchRow`/
 * `MatchStore` (`TASK-0115`'s own minimal prerequisite module, see its
 * doc comment) directly, the same cross-module reuse the TS side
 * already does. No new research -- see that module's own doc comment
 * for the full grounding (the `BR-022`→`SEC-016` citation finding; the
 * deliberate rejection-not-no-op departure from `deactivateMember`'s
 * own choice).
 */

data class ClaimMatchPayload(val organizationId: String?)

sealed class ClaimMatchResult {
    data class Claimed(val row: MatchRow) : ClaimMatchResult()
    data class Rejected(val problem: ApiProblem) : ClaimMatchResult()
}

/** Per-endpoint idempotency-key cache -- a second, independent
 * instance of the same interface shape `deactivatemember`'s own
 * module already defines. */
interface IdempotencyStore {
    fun getPriorSuccess(key: String): ClaimMatchResult?
    fun recordSuccess(key: String, result: ClaimMatchResult)
}

/**
 * Transitions `claimStatus` from `GUEST` to `CLAIMED`, optionally
 * binding `organizationId`. `matchId`, timeline, and provenance are
 * untouched.
 */
fun claimMatch(
    matchId: String,
    payload: ClaimMatchPayload,
    matchStore: MatchStore,
    idempotencyStore: IdempotencyStore,
    actorRef: String,
    nowIso: String,
    idempotencyKey: String,
    instance: String,
): ClaimMatchResult {
    val priorResult = idempotencyStore.getPriorSuccess(idempotencyKey)
    if (priorResult != null) {
        return priorResult
    }

    val existing = matchStore.get(matchId)
        ?: return ClaimMatchResult.Rejected(notFoundError("No match visible with id $matchId", instance))

    if (existing.claimStatus == MatchClaimStatus.CLAIMED) {
        return ClaimMatchResult.Rejected(invalidTransitionError("Match $matchId is already claimed", instance))
    }

    val updatedRow = existing.copy(
        claimStatus = MatchClaimStatus.CLAIMED,
        organizationId = payload.organizationId,
        rowVersion = existing.rowVersion + 1,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )

    matchStore.update(updatedRow)

    val result = ClaimMatchResult.Claimed(updatedRow)
    idempotencyStore.recordSuccess(idempotencyKey, result)
    return result
}

/** An in-memory IdempotencyStore for tests -- not a production adapter. */
class InMemoryIdempotencyStore : IdempotencyStore {
    private val successesByKey = mutableMapOf<String, ClaimMatchResult>()

    override fun getPriorSuccess(key: String): ClaimMatchResult? = successesByKey[key]
    override fun recordSuccess(key: String, result: ClaimMatchResult) { successesByKey[key] = result }
}
