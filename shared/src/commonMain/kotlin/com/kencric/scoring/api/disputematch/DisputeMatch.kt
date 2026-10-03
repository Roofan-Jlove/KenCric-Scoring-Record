package com.kencric.scoring.api.disputematch

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.businessRuleValidationError
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError
import com.kencric.scoring.api.matches.MatchRow
import com.kencric.scoring.api.matches.MatchState
import com.kencric.scoring.api.matches.MatchStore

/**
 * TASK-0128: a field-for-field Kotlin port of `backend/src/commands/
 * disputeMatch.ts` (`TASK-0123`/`0124`), the 16th Android backend-
 * command port. No new research -- see that module's own doc comment
 * for the full grounding (the tenth discovery-vs-SRS citation
 * collision; the domain-model-vs-API-spec tension over `ENT-DISPUTE`;
 * the scoring-write-refusal scope boundary). Reuses
 * `com.kencric.scoring.api.matches`'s own `MatchRow`/`MatchState`/
 * `MatchStore` directly via cross-module import (widened by this same
 * task, `TASK-0128`, to add `MatchState`/`MatchRow.state` -- that
 * minimal module never carried either before, since `claimMatch`'s own
 * port never needed them).
 */

enum class DisputeStatus { OPEN, ADJUDICATED }

data class DisputeRow(
    val id: String,
    val matchId: String,
    val status: DisputeStatus,
    val reason: String,
    val lockedFromState: MatchState,
    val lockedBy: String,
    val lockedAt: String,
    val ruling: String? = null,
    val resultingCorrections: List<String>? = null,
    val adjudicatedBy: String? = null,
    val adjudicatedAt: String? = null,
    val rowVersion: Int,
)

interface DisputeStore {
    fun get(id: String): DisputeRow?
    /** Backs the app-level "at most one OPEN dispute per match" rule. */
    fun getOpenByMatchId(matchId: String): DisputeRow?
    fun insert(row: DisputeRow)
    fun update(row: DisputeRow)
    fun list(): List<DisputeRow>
}

data class LockMatchForDisputePayload(val reason: String? = null)

sealed class LockMatchForDisputeResult {
    data class Locked(val row: DisputeRow) : LockMatchForDisputeResult()
    data class Rejected(val problem: ApiProblem) : LockMatchForDisputeResult()
}

/** `POST /matches/{matchId}/dispute`. */
fun lockMatchForDispute(
    matchId: String,
    payload: LockMatchForDisputePayload,
    matchStore: MatchStore,
    disputeStore: DisputeStore,
    newDisputeId: String,
    actorRef: String,
    nowIso: String,
    instance: String,
): LockMatchForDisputeResult {
    if (payload.reason.isNullOrEmpty()) {
        return LockMatchForDisputeResult.Rejected(schemaValidationError("Missing required field: reason", instance))
    }

    val match = matchStore.get(matchId)
        ?: return LockMatchForDisputeResult.Rejected(notFoundError("No match visible with id $matchId", instance))

    if (match.state == MatchState.DISPUTED) {
        return LockMatchForDisputeResult.Rejected(invalidTransitionError("Match $matchId is already locked for dispute", instance))
    }

    if (disputeStore.getOpenByMatchId(matchId) != null) {
        return LockMatchForDisputeResult.Rejected(businessRuleValidationError("Match $matchId already has an open dispute", instance))
    }

    val disputeRow = DisputeRow(
        id = newDisputeId,
        matchId = matchId,
        status = DisputeStatus.OPEN,
        reason = payload.reason,
        lockedFromState = match.state,
        lockedBy = actorRef,
        lockedAt = nowIso,
        rowVersion = 1,
    )
    disputeStore.insert(disputeRow)

    val updatedMatch = match.copy(state = MatchState.DISPUTED, rowVersion = match.rowVersion + 1, updatedAt = nowIso, updatedBy = actorRef)
    matchStore.update(updatedMatch)

    return LockMatchForDisputeResult.Locked(disputeRow)
}

data class AdjudicateDisputePayload(
    val ruling: String? = null,
    val resultingCorrections: List<String>? = null,
)

sealed class AdjudicateDisputeResult {
    data class Adjudicated(val row: DisputeRow) : AdjudicateDisputeResult()
    data class Rejected(val problem: ApiProblem) : AdjudicateDisputeResult()
}

/** `POST /matches/{matchId}/dispute/adjudicate`. Unlocks the match back to its pre-lock state. */
fun adjudicateDispute(
    matchId: String,
    payload: AdjudicateDisputePayload,
    matchStore: MatchStore,
    disputeStore: DisputeStore,
    actorRef: String,
    nowIso: String,
    instance: String,
): AdjudicateDisputeResult {
    if (payload.ruling.isNullOrEmpty()) {
        return AdjudicateDisputeResult.Rejected(schemaValidationError("Missing required field: ruling", instance))
    }

    val dispute = disputeStore.getOpenByMatchId(matchId)
        ?: return AdjudicateDisputeResult.Rejected(notFoundError("No open dispute visible for match $matchId", instance))

    val match = matchStore.get(matchId)
        ?: return AdjudicateDisputeResult.Rejected(notFoundError("No match visible with id $matchId", instance))

    val updatedDispute = dispute.copy(
        status = DisputeStatus.ADJUDICATED,
        ruling = payload.ruling,
        resultingCorrections = payload.resultingCorrections,
        adjudicatedBy = actorRef,
        adjudicatedAt = nowIso,
        rowVersion = dispute.rowVersion + 1,
    )
    disputeStore.update(updatedDispute)

    val updatedMatch = match.copy(state = dispute.lockedFromState, rowVersion = match.rowVersion + 1, updatedAt = nowIso, updatedBy = actorRef)
    matchStore.update(updatedMatch)

    return AdjudicateDisputeResult.Adjudicated(updatedDispute)
}

/** `GET /disputes/{id}`. `FR-159`'s own Description text names "view dispute trails" as part of the org-admin console. */
sealed class GetDisputeResult {
    data class Found(val row: DisputeRow) : GetDisputeResult()
    data class Rejected(val problem: ApiProblem) : GetDisputeResult()
}

fun getDispute(id: String, store: DisputeStore, instance: String): GetDisputeResult {
    val row = store.get(id)
        ?: return GetDisputeResult.Rejected(notFoundError("No dispute visible with id $id", instance))
    return GetDisputeResult.Found(row)
}

data class ListDisputesQuery(
    val after: String? = null,
    val limit: Int? = null,
    val matchId: String? = null,
    val status: DisputeStatus? = null,
)

data class ListDisputesResult(
    val items: List<DisputeRow>,
    val nextCursor: String?,
    val hasMore: Boolean,
)

private const val DEFAULT_LIMIT = 50
private const val MAX_LIMIT = 200

/** `GET /disputes`. Keyset-paginated by `id` ascending; `matchId`/`status` are both the table's own real `IX` columns. */
fun listDisputes(query: ListDisputesQuery, store: DisputeStore): ListDisputesResult {
    val limit = minOf(query.limit ?: DEFAULT_LIMIT, MAX_LIMIT)

    var rows = store.list().sortedBy { it.id }

    if (query.matchId != null) {
        rows = rows.filter { it.matchId == query.matchId }
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

    return ListDisputesResult(items = page, nextCursor = nextCursor, hasMore = hasMore)
}

/** An in-memory DisputeStore for tests -- not a production adapter. */
class InMemoryDisputeStore : DisputeStore {
    private val rows = mutableMapOf<String, DisputeRow>()

    override fun get(id: String): DisputeRow? = rows[id]

    override fun getOpenByMatchId(matchId: String): DisputeRow? =
        rows.values.find { it.matchId == matchId && it.status == DisputeStatus.OPEN }

    override fun insert(row: DisputeRow) { rows[row.id] = row }
    override fun update(row: DisputeRow) { rows[row.id] = row }
    override fun list(): List<DisputeRow> = rows.values.toList()
}
