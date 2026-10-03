package com.kencric.scoring.api.signoffmatch

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.authForbidden
import com.kencric.scoring.api.errors.invalidTransitionError
import com.kencric.scoring.api.errors.reconciliationBlockedError
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0118: a field-for-field Kotlin port of `backend/src/commands/
 * signOffMatch.ts` (`TASK-0105`), the 13th and final of 13 Android
 * backend-command ports. No new research -- see that module's own doc
 * comment for the full grounding (the `FR-106`→`FR-103` citation
 * finding; the `FR-102` addition; the deliberate role-check departure
 * from this cluster's own "don't check roles" default, since `§11.1`'s
 * own registry names the `403` as part of its own contract).
 */

enum class ReconciliationCheckStatus { PASS, FAIL }

data class ReconciliationCheck(
    val invariantId: String,
    val status: ReconciliationCheckStatus,
    val detail: String?,
)

enum class Role { HEAD_SCORER, ASSISTANT_SCORER, UMPIRE, ADMIN }

fun failingChecks(checks: List<ReconciliationCheck>): List<ReconciliationCheck> =
    checks.filter { it.status == ReconciliationCheckStatus.FAIL }

fun reconciliationPasses(checks: List<ReconciliationCheck>): Boolean =
    failingChecks(checks).isEmpty()

enum class SignOffReconciliationState { PASS, OVERRIDE }

data class SignOffRow(
    val id: String,
    val matchId: String,
    val version: Int,
    val signedBy: String,
    val reconciliationState: SignOffReconciliationState,
    val overrideReason: String?,
    val signedAt: String,
    val supersedesVersion: Int?,
)

interface SignOffStore {
    fun get(id: String): SignOffRow?
    fun insert(row: SignOffRow)
}

data class SignOffMatchInput(
    val matchId: String,
    val actorRole: Role,
    val checks: List<ReconciliationCheck>,
    val overrideReason: String?,
    val asOfEventOrdinal: Int,
    val currentServerEventOrdinal: Int,
    val previousVersion: Int,
    val signedBy: String,
)

sealed class SignOffMatchResult {
    data class Signed(val row: SignOffRow) : SignOffMatchResult()
    data class Rejected(val problem: ApiProblem) : SignOffMatchResult()
}

/** Per-endpoint idempotency-key cache -- a sixth, independent instance of the same interface shape. */
interface IdempotencyStore {
    fun getPriorSuccess(key: String): SignOffMatchResult?
    fun recordSuccess(key: String, result: SignOffMatchResult)
}

/**
 * Mirrors `signOffForm.ts`'s own `attemptSignOff`: the role check
 * (`I-H2`) is checked before the reconciliation gate (`I-H1`);
 * `version` increments by exactly 1 from `previousVersion` (`N-H1`).
 * Adds the ordinal-staleness check and persistence, neither of which
 * exist at the UI layer.
 */
fun signOffMatch(
    input: SignOffMatchInput,
    store: SignOffStore,
    idempotencyStore: IdempotencyStore,
    idempotencyKey: String,
    newSignOffId: String,
    nowIso: String,
    instance: String,
): SignOffMatchResult {
    val priorResult = idempotencyStore.getPriorSuccess(idempotencyKey)
    if (priorResult != null) return priorResult

    if (input.matchId.isEmpty()) {
        return SignOffMatchResult.Rejected(schemaValidationError("Missing required field: matchId", instance))
    }

    if (input.actorRole != Role.HEAD_SCORER) {
        return SignOffMatchResult.Rejected(authForbidden("Only the Head Scorer may sign off this match", instance))
    }

    if (input.asOfEventOrdinal < input.currentServerEventOrdinal) {
        return SignOffMatchResult.Rejected(
            invalidTransitionError(
                "asOfEventOrdinal ${input.asOfEventOrdinal} is behind the server's current view (${input.currentServerEventOrdinal}) -- re-pull and retry",
                instance,
            ),
        )
    }

    val failing = failingChecks(input.checks)
    if (failing.isNotEmpty() && (input.overrideReason == null || input.overrideReason.trim().isEmpty())) {
        return SignOffMatchResult.Rejected(
            reconciliationBlockedError(
                "Reconciliation failed: ${failing.joinToString(", ") { it.invariantId }} -- supply overrideReason to proceed anyway",
                instance,
            ),
        )
    }

    val row = SignOffRow(
        id = newSignOffId,
        matchId = input.matchId,
        version = input.previousVersion + 1,
        signedBy = input.signedBy,
        reconciliationState = if (failing.isNotEmpty()) SignOffReconciliationState.OVERRIDE else SignOffReconciliationState.PASS,
        overrideReason = if (failing.isNotEmpty()) input.overrideReason else null,
        signedAt = nowIso,
        supersedesVersion = if (input.previousVersion > 0) input.previousVersion else null,
    )

    store.insert(row)

    val result = SignOffMatchResult.Signed(row)
    idempotencyStore.recordSuccess(idempotencyKey, result)
    return result
}

/** An in-memory SignOffStore for tests -- not a production adapter. No update method exists -- sign-offs are immutable once created. */
class InMemorySignOffStore : SignOffStore {
    private val rows = mutableMapOf<String, SignOffRow>()
    override fun get(id: String): SignOffRow? = rows[id]
    override fun insert(row: SignOffRow) { rows[row.id] = row }
}

/** An in-memory IdempotencyStore for tests -- not a production adapter. */
class InMemoryIdempotencyStore : IdempotencyStore {
    private val successesByKey = mutableMapOf<String, SignOffMatchResult>()
    override fun getPriorSuccess(key: String): SignOffMatchResult? = successesByKey[key]
    override fun recordSuccess(key: String, result: SignOffMatchResult) { successesByKey[key] = result }
}
