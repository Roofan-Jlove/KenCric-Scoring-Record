package com.kencric.scoring.api.mergeplayers

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.businessRuleValidationError
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError
import com.kencric.scoring.api.players.PlayerRow
import com.kencric.scoring.api.players.PlayerStatus
import com.kencric.scoring.api.players.PlayerStore

/**
 * TASK-0127: a field-for-field Kotlin port of `backend/src/commands/
 * mergePlayers.ts` (`TASK-0121`), the 15th Android backend-command
 * port. No new research -- see that module's own doc comment for the
 * full grounding (the deliberate priority-scope override; the real
 * architectural boundary -- this does NOT rewrite `player_id`
 * references inside the hash-chained event store, "re-pointing" is a
 * read-time resolution through `mergedIntoPlayerId` only; the
 * caller-supplied `PlayerAppearanceLookup` boundary). Reuses
 * `com.kencric.scoring.api.players`'s own `PlayerRow`/`PlayerStatus`/
 * `PlayerStore` directly via cross-module import, the same shape
 * `deactivateMember` already established against `memberships`.
 */

data class MergePlayersPayload(
    val losingPlayerId: String? = null,
    val reason: String? = null,
)

/**
 * Resolves a player's distinct appearance dates (one per match they
 * appeared in) -- backed by `matches.home_xi`/`away_xi` and the
 * scoring read model in a real adapter, neither of which this module
 * has a store for. A test double supplies this directly rather than
 * this module computing it.
 */
interface PlayerAppearanceLookup {
    fun listAppearanceDates(playerId: String): List<String>
}

sealed class MergePlayersResult {
    data class Merged(val row: PlayerRow) : MergePlayersResult()
    data class Rejected(val problem: ApiProblem) : MergePlayersResult()
}

/**
 * `survivingPlayerId` is the path parameter -- the id that survives.
 * `payload.losingPlayerId` is merged into it and marked `MERGED`.
 */
fun mergePlayers(
    survivingPlayerId: String,
    payload: MergePlayersPayload,
    store: PlayerStore,
    appearanceLookup: PlayerAppearanceLookup,
    actorRef: String,
    nowIso: String,
    instance: String,
): MergePlayersResult {
    if (payload.losingPlayerId.isNullOrEmpty()) {
        return MergePlayersResult.Rejected(schemaValidationError("Missing required field: losingPlayerId", instance))
    }
    if (payload.reason.isNullOrEmpty()) {
        return MergePlayersResult.Rejected(schemaValidationError("Missing required field: reason", instance))
    }

    if (payload.losingPlayerId == survivingPlayerId) {
        return MergePlayersResult.Rejected(businessRuleValidationError("A player cannot be merged into itself", instance))
    }

    val survivor = store.get(survivingPlayerId)
        ?: return MergePlayersResult.Rejected(notFoundError("No player visible with id $survivingPlayerId", instance))

    val loser = store.get(payload.losingPlayerId)
        ?: return MergePlayersResult.Rejected(notFoundError("No player visible with id ${payload.losingPlayerId}", instance))

    if (survivor.status == PlayerStatus.MERGED) {
        return MergePlayersResult.Rejected(
            invalidTransitionError("Player $survivingPlayerId is itself already merged -- merge into its own ultimate survivor instead", instance),
        )
    }
    if (loser.status == PlayerStatus.MERGED) {
        return MergePlayersResult.Rejected(invalidTransitionError("Player ${payload.losingPlayerId} is already merged", instance))
    }

    val survivorDates = appearanceLookup.listAppearanceDates(survivingPlayerId).toSet()
    val conflictingDates = appearanceLookup.listAppearanceDates(payload.losingPlayerId).filter { survivorDates.contains(it) }
    if (conflictingDates.isNotEmpty()) {
        return MergePlayersResult.Rejected(
            businessRuleValidationError(
                "Players $survivingPlayerId and ${payload.losingPlayerId} both have appearances on: ${conflictingDates.joinToString(", ")} -- needs manual review before merging",
                instance,
            ),
        )
    }

    val updatedLoser = loser.copy(
        status = PlayerStatus.MERGED,
        mergedIntoPlayerId = survivingPlayerId,
        rowVersion = loser.rowVersion + 1,
        updatedAt = nowIso,
        updatedBy = actorRef,
    )
    store.update(updatedLoser)

    return MergePlayersResult.Merged(survivor)
}

/** An in-memory PlayerAppearanceLookup for tests -- not a production adapter. */
class InMemoryPlayerAppearanceLookup : PlayerAppearanceLookup {
    private val datesByPlayerId = mutableMapOf<String, List<String>>()

    fun seed(playerId: String, dates: List<String>) {
        datesByPlayerId[playerId] = dates
    }

    override fun listAppearanceDates(playerId: String): List<String> = datesByPlayerId[playerId] ?: emptyList()
}
