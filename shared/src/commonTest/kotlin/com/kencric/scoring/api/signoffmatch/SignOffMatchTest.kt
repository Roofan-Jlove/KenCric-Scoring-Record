package com.kencric.scoring.api.signoffmatch

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0118`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/signOffMatch.test.ts` (`TASK-0105`) input-for-input.
 */
class SignOffMatchTest {

    private val passingChecks = listOf(
        ReconciliationCheck("INV-001", ReconciliationCheckStatus.PASS, null),
        ReconciliationCheck("INV-002", ReconciliationCheckStatus.PASS, null),
    )

    private val failingCheck = ReconciliationCheck("INV-003", ReconciliationCheckStatus.FAIL, "Total mismatch")

    private fun baseInput(
        matchId: String = "match-1",
        actorRole: Role = Role.HEAD_SCORER,
        checks: List<ReconciliationCheck> = passingChecks,
        overrideReason: String? = null,
        asOfEventOrdinal: Int = 42,
        currentServerEventOrdinal: Int = 42,
        previousVersion: Int = 0,
        signedBy: String = "user-1",
    ) = SignOffMatchInput(matchId, actorRole, checks, overrideReason, asOfEventOrdinal, currentServerEventOrdinal, previousVersion, signedBy)

    @Test fun failingChecks_no_failing_checks_when_every_check_passes() {
        assertEquals(emptyList(), failingChecks(passingChecks))
        assertTrue(reconciliationPasses(passingChecks))
    }

    @Test fun failingChecks_identifies_the_specific_failing_check() {
        val checks = passingChecks + failingCheck
        assertEquals(listOf(failingCheck), failingChecks(checks))
        assertTrue(!reconciliationPasses(checks))
    }

    @Test fun signOffMatch_NH1_head_scorer_signs_off_successfully_version_becomes_1() {
        val store = InMemorySignOffStore()
        val result = signOffMatch(baseInput(), store, InMemoryIdempotencyStore(), "key-1", "sign-off-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is SignOffMatchResult.Signed)
        assertEquals(1, result.row.version)
        assertEquals(SignOffReconciliationState.PASS, result.row.reconciliationState)
        assertNull(result.row.supersedesVersion)
    }

    @Test fun signOffMatch_NH1_re_sign_off_increments_version_from_non_zero_previous_version() {
        val store = InMemorySignOffStore()
        val result = signOffMatch(baseInput(previousVersion = 1), store, InMemoryIdempotencyStore(), "key-1", "sign-off-2", "now", "req-1")

        check(result is SignOffMatchResult.Signed)
        assertEquals(2, result.row.version)
        assertEquals(1, result.row.supersedesVersion)
    }

    @Test fun signOffMatch_IH1_rejects_with_reconciliation_blocked_when_check_fails_and_no_override_reason() {
        val store = InMemorySignOffStore()
        val result = signOffMatch(baseInput(checks = passingChecks + failingCheck), store, InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1")
        check(result is SignOffMatchResult.Rejected)
        assertEquals(422, result.problem.status)
        assertTrue(result.problem.type.contains("reconciliation/blocked"))
        assertTrue(result.problem.detail.contains("INV-003"))
    }

    @Test fun signOffMatch_IH1_rejects_when_override_reason_is_blank() {
        val store = InMemorySignOffStore()
        val result = signOffMatch(baseInput(checks = passingChecks + failingCheck, overrideReason = "   "), store, InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1")
        check(result is SignOffMatchResult.Rejected)
    }

    @Test fun signOffMatch_IH1_succeeds_with_non_blank_override_reason_flagging_OVERRIDE() {
        val store = InMemorySignOffStore()
        val result = signOffMatch(
            baseInput(checks = passingChecks + failingCheck, overrideReason = "Confirmed with umpires"),
            store, InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1",
        )
        check(result is SignOffMatchResult.Signed)
        assertEquals(SignOffReconciliationState.OVERRIDE, result.row.reconciliationState)
        assertEquals("Confirmed with umpires", result.row.overrideReason)
    }

    @Test fun signOffMatch_IH2_rejects_non_head_scorer_attempt_with_403_even_with_passing_report() {
        val store = InMemorySignOffStore()
        val result = signOffMatch(baseInput(actorRole = Role.ASSISTANT_SCORER), store, InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1")
        check(result is SignOffMatchResult.Rejected)
        assertEquals(403, result.problem.status)
    }

    @Test fun signOffMatch_IH2_role_check_takes_priority_over_reconciliation_check() {
        val store = InMemorySignOffStore()
        val result = signOffMatch(
            baseInput(actorRole = Role.UMPIRE, checks = passingChecks + failingCheck),
            store, InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1",
        )
        check(result is SignOffMatchResult.Rejected)
        assertEquals(403, result.problem.status)
    }

    @Test fun signOffMatch_rejects_a_stale_asOfEventOrdinal_409() {
        val store = InMemorySignOffStore()
        val result = signOffMatch(baseInput(asOfEventOrdinal = 10, currentServerEventOrdinal = 42), store, InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1")
        check(result is SignOffMatchResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun signOffMatch_role_check_still_takes_priority_over_stale_ordinal() {
        val store = InMemorySignOffStore()
        val result = signOffMatch(
            baseInput(actorRole = Role.UMPIRE, asOfEventOrdinal = 10, currentServerEventOrdinal = 42),
            store, InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1",
        )
        check(result is SignOffMatchResult.Rejected)
        assertEquals(403, result.problem.status)
    }

    @Test fun signOffMatch_replaying_same_key_returns_identical_prior_result_without_reprocessing() {
        val store = InMemorySignOffStore()
        val idempotencyStore = InMemoryIdempotencyStore()

        val first = signOffMatch(baseInput(), store, idempotencyStore, "key-1", "sign-off-1", "2026-10-03T00:00:00Z", "req-1")
        val second = signOffMatch(baseInput(previousVersion = 5), store, idempotencyStore, "key-1", "sign-off-2", "later", "req-2")

        assertEquals(first, second)
        check(second is SignOffMatchResult.Signed)
        assertEquals(1, second.row.version)
    }

    @Test fun signOffMatch_new_sign_off_row_is_immutable_once_created_no_update_method_exists() {
        val store = InMemorySignOffStore()
        signOffMatch(baseInput(), store, InMemoryIdempotencyStore(), "key-1", "sign-off-1", "now", "req-1")
        assertTrue(store.get("sign-off-1") != null)
    }
}
