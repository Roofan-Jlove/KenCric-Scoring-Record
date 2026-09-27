package com.kencric.scoring.ui.screens.ux22matchsummary

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * `TASK-0080`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-22-match-summary/signOffForm.test.ts`
 * (`TASK-0079`) input-for-input.
 */
class SignOffFormTest {

    private val passingChecks = listOf(
        ReconciliationCheck("INV-001", ReconciliationCheckStatus.PASS, null),
        ReconciliationCheck("INV-002", ReconciliationCheckStatus.PASS, null),
    )
    private val failingCheck = ReconciliationCheck("INV-003", ReconciliationCheckStatus.FAIL, "Total mismatch")

    @Test fun no_failing_checks_when_every_check_passes() {
        assertEquals(emptyList(), failingChecks(passingChecks))
        assertTrue(reconciliationPasses(passingChecks))
    }

    @Test fun identifies_the_specific_failing_check() {
        val checks = passingChecks + failingCheck
        assertEquals(listOf(failingCheck), failingChecks(checks))
        assertTrue(!reconciliationPasses(checks))
    }

    // N-H1
    @Test fun a_head_scorer_signs_off_successfully_version_becomes_1() {
        val attempt = SignOffAttempt(checks = passingChecks, actorRole = Role.HEAD_SCORER, overrideReason = null)
        assertEquals(SignOffResult.Signed(version = 1, overrideUsed = false), attemptSignOff(attempt, 0))
    }

    @Test fun a_re_sign_off_increments_the_version_from_a_non_zero_previous_version() {
        val attempt = SignOffAttempt(checks = passingChecks, actorRole = Role.HEAD_SCORER, overrideReason = null)
        assertEquals(SignOffResult.Signed(version = 2, overrideUsed = false), attemptSignOff(attempt, 1))
    }

    // I-H1
    @Test fun rejects_with_reconciliation_blocked_when_a_check_fails_and_no_override_reason_is_supplied() {
        val attempt = SignOffAttempt(checks = passingChecks + failingCheck, actorRole = Role.HEAD_SCORER, overrideReason = null)
        assertEquals(SignOffResult.RejectedReconciliation(listOf(failingCheck)), attemptSignOff(attempt, 0))
    }

    @Test fun rejects_when_the_override_reason_is_blank() {
        val attempt = SignOffAttempt(checks = passingChecks + failingCheck, actorRole = Role.HEAD_SCORER, overrideReason = "   ")
        assertTrue(attemptSignOff(attempt, 0) is SignOffResult.RejectedReconciliation)
    }

    @Test fun succeeds_with_a_non_blank_override_reason_flagging_overrideUsed() {
        val attempt = SignOffAttempt(
            checks = passingChecks + failingCheck,
            actorRole = Role.HEAD_SCORER,
            overrideReason = "Confirmed with umpires",
        )
        assertEquals(SignOffResult.Signed(version = 1, overrideUsed = true), attemptSignOff(attempt, 0))
    }

    // I-H2
    @Test fun rejects_a_non_head_scorer_attempt_even_with_a_passing_report() {
        val attempt = SignOffAttempt(checks = passingChecks, actorRole = Role.ASSISTANT_SCORER, overrideReason = null)
        assertEquals(SignOffResult.RejectedForbidden, attemptSignOff(attempt, 0))
    }

    @Test fun the_role_check_takes_priority_over_the_reconciliation_check() {
        val attempt = SignOffAttempt(checks = passingChecks + failingCheck, actorRole = Role.UMPIRE, overrideReason = null)
        assertEquals(SignOffResult.RejectedForbidden, attemptSignOff(attempt, 0))
    }
}
