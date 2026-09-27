package com.kencric.scoring.ui.screens.ux22matchsummary

/**
 * TASK-0080: `ux-specification.md UX-22`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-22-match-summary/signOffForm.ts`
 * (`TASK-0079`) -- same contract-only scope note as every earlier
 * screen this session: no Android SDK/Gradle/Kotlin toolchain exists,
 * placed in `shared/commonMain` since this logic touches no Android API
 * surface at all.
 *
 * See `TASK-0079`'s own file for the full grounding (`acceptance-
 * criteria.md N-H1`/`I-H1`/`I-H2`, confirmed genuinely unbuilt logic,
 * and the discovery-level `FR-104/105/106/108` citation note).
 */

enum class ReconciliationCheckStatus { PASS, FAIL }

data class ReconciliationCheck(
    val invariantId: String,
    val status: ReconciliationCheckStatus,
    val detail: String?,
)

enum class Role { HEAD_SCORER, ASSISTANT_SCORER, UMPIRE, ADMIN }

data class SignOffAttempt(
    val checks: List<ReconciliationCheck>,
    val actorRole: Role,
    val overrideReason: String?,
)

sealed class SignOffResult {
    data class Signed(val version: Int, val overrideUsed: Boolean) : SignOffResult()
    data class RejectedReconciliation(val failingChecks: List<ReconciliationCheck>) : SignOffResult()
    object RejectedForbidden : SignOffResult()
}

fun failingChecks(checks: List<ReconciliationCheck>): List<ReconciliationCheck> =
    checks.filter { it.status == ReconciliationCheckStatus.FAIL }

fun reconciliationPasses(checks: List<ReconciliationCheck>): Boolean = failingChecks(checks).isEmpty()

/**
 * `I-H2`: a non-Head-Scorer attempt is rejected, checked before
 * reconciliation. `I-H1`: an open `FAIL` with no override reason is
 * rejected, naming the specific failing checks. `N-H1`: a passing
 * report signs off, incrementing the version by exactly 1.
 */
fun attemptSignOff(attempt: SignOffAttempt, previousVersion: Int): SignOffResult {
    if (attempt.actorRole != Role.HEAD_SCORER) {
        return SignOffResult.RejectedForbidden
    }
    val failing = failingChecks(attempt.checks)
    if (failing.isNotEmpty() && (attempt.overrideReason == null || attempt.overrideReason.trim().isEmpty())) {
        return SignOffResult.RejectedReconciliation(failing)
    }
    return SignOffResult.Signed(version = previousVersion + 1, overrideUsed = failing.isNotEmpty())
}
