package com.kencric.scoring.api.divergenceresolution

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.businessRuleValidationError
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.notFoundError
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0129: a field-for-field Kotlin port of `backend/src/commands/
 * divergenceResolution.ts` (`TASK-0125`), the 17th and final Android
 * backend-command port of this round. No new research -- see that
 * module's own doc comment for the full grounding (the synthesized,
 * not-ported, contract; the eleventh discovery-vs-SRS citation
 * collision; the `CONFIRMED`-vs-`RESOLVED` terminology mismatch; the
 * caller-supplied `resolvedEventId` boundary).
 *
 * **A real, explicit scoping difference from every prior port in this
 * cluster:** `divergenceResolution.ts` imports `DivergenceRecord`/
 * `DivergenceStore` from `../sync/divergenceDetector.js` -- a module
 * in `backend/src/sync/`, not `backend/src/commands/`, and therefore
 * never one of the original 13 modules this Android cluster ported
 * (that cluster only ever covered `backend/src/commands/*.ts`).
 * Rather than build a separate minimal prerequisite package (the
 * `TASK-0115`/`api.matches` shape) for a module whose own detection
 * algorithm (`detectDivergences`/`detectAndRecordDivergences`) this
 * task doesn't need at all, `DivergenceRecord`/`DivergenceStatus`/
 * `DivergenceStore` are defined directly in this package instead --
 * self-contained, not imported from an unported sibling.
 */

enum class DivergenceStatus { OPEN, PROPOSED, RESOLVED }

data class DivergenceRecord(
    val matchId: String,
    val overBall: String,
    val field: String,
    val streamAId: String,
    val streamBId: String,
    val valueA: Any?,
    val valueB: Any?,
    val status: DivergenceStatus,
    val id: String? = null,
    val proposedValue: Any? = null,
    val proposedBy: String? = null,
    val confirmedBy: String? = null,
    val resolvedEventId: String? = null,
)

interface DivergenceStore {
    fun get(id: String): DivergenceRecord?
    fun insert(record: DivergenceRecord)
    fun update(record: DivergenceRecord)
}

/**
 * `proposedValue` defaults to the `Unit` sentinel, not `null` -- the TS
 * side checks `payload.proposedValue === undefined` (a truly absent
 * field, distinct from an explicitly-`null` proposed value), and
 * `Unit` can never collide with a real divergence value the way a
 * default of `null` would.
 */
data class ProposeDivergenceResolutionPayload(val proposedValue: Any? = Unit)

sealed class ProposeDivergenceResolutionResult {
    data class Proposed(val row: DivergenceRecord) : ProposeDivergenceResolutionResult()
    data class Rejected(val problem: ApiProblem) : ProposeDivergenceResolutionResult()
}

/** Only an `OPEN` divergence may have a resolution proposed. */
fun proposeDivergenceResolution(
    divergenceId: String,
    payload: ProposeDivergenceResolutionPayload,
    proposedBy: String,
    store: DivergenceStore,
    instance: String,
): ProposeDivergenceResolutionResult {
    if (payload.proposedValue == Unit) {
        return ProposeDivergenceResolutionResult.Rejected(schemaValidationError("Missing required field: proposedValue", instance))
    }

    val existing = store.get(divergenceId)
        ?: return ProposeDivergenceResolutionResult.Rejected(notFoundError("No divergence visible with id $divergenceId", instance))

    if (existing.status != DivergenceStatus.OPEN) {
        return ProposeDivergenceResolutionResult.Rejected(
            invalidTransitionError("Divergence $divergenceId is ${existing.status}, not OPEN -- cannot propose a resolution", instance),
        )
    }

    val updated = existing.copy(status = DivergenceStatus.PROPOSED, proposedValue = payload.proposedValue, proposedBy = proposedBy)
    store.update(updated)
    return ProposeDivergenceResolutionResult.Proposed(updated)
}

data class ConfirmDivergenceResolutionPayload(val resolvedEventId: String? = null)

sealed class ConfirmDivergenceResolutionResult {
    data class Confirmed(val row: DivergenceRecord) : ConfirmDivergenceResolutionResult()
    data class Rejected(val problem: ApiProblem) : ConfirmDivergenceResolutionResult()
}

/**
 * Only a `PROPOSED` divergence may be confirmed, and only by a scorer
 * distinct from whoever proposed it (`MINV-14`/`BR-008`).
 */
fun confirmDivergenceResolution(
    divergenceId: String,
    payload: ConfirmDivergenceResolutionPayload,
    confirmedBy: String,
    store: DivergenceStore,
    instance: String,
): ConfirmDivergenceResolutionResult {
    if (payload.resolvedEventId.isNullOrEmpty()) {
        return ConfirmDivergenceResolutionResult.Rejected(schemaValidationError("Missing required field: resolvedEventId", instance))
    }

    val existing = store.get(divergenceId)
        ?: return ConfirmDivergenceResolutionResult.Rejected(notFoundError("No divergence visible with id $divergenceId", instance))

    if (existing.status != DivergenceStatus.PROPOSED) {
        return ConfirmDivergenceResolutionResult.Rejected(
            invalidTransitionError("Divergence $divergenceId is ${existing.status}, not PROPOSED -- cannot confirm", instance),
        )
    }

    if (confirmedBy == existing.proposedBy) {
        return ConfirmDivergenceResolutionResult.Rejected(
            businessRuleValidationError("confirmedBy must be a distinct scorer from proposedBy (MINV-14/BR-008)", instance),
        )
    }

    val updated = existing.copy(status = DivergenceStatus.RESOLVED, confirmedBy = confirmedBy, resolvedEventId = payload.resolvedEventId)
    store.update(updated)
    return ConfirmDivergenceResolutionResult.Confirmed(updated)
}

/** An in-memory DivergenceStore for tests -- not a production adapter. Auto-assigns `id` at insert time, same as the TS side's own test double. */
class InMemoryDivergenceStore : DivergenceStore {
    private val rows = mutableMapOf<String, DivergenceRecord>()
    private var nextId = 1

    fun insertSeed(record: DivergenceRecord): DivergenceRecord {
        val withId = if (record.id == null) record.copy(id = "divergence-${nextId++}") else record
        rows[withId.id!!] = withId
        return withId
    }

    override fun get(id: String): DivergenceRecord? = rows[id]
    override fun insert(record: DivergenceRecord) { insertSeed(record) }
    override fun update(record: DivergenceRecord) { rows[record.id!!] = record }
}
