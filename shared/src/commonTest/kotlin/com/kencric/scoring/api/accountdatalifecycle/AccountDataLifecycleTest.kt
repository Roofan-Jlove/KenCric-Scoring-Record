package com.kencric.scoring.api.accountdatalifecycle

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0117`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/accountDataLifecycle.test.ts` (`TASK-0104`)
 * input-for-input.
 */
class AccountDataLifecycleTest {

    @Test fun requestPersonalDataExport_queues_a_new_export_job() {
        val store = InMemoryPersonalDataExportStore()
        val idempotencyStore = InMemoryExportIdempotencyStore()

        val result = requestPersonalDataExport("user-1", store, idempotencyStore, "key-1", "export-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is RequestPersonalDataExportResult.Queued)
        assertEquals(PersonalExportStatus.QUEUED, result.row.status)
        assertEquals("user-1", result.row.userId)
    }

    @Test fun requestPersonalDataExport_missing_userId_is_schema_failure_400() {
        val store = InMemoryPersonalDataExportStore()
        val result = requestPersonalDataExport("", store, InMemoryExportIdempotencyStore(), "key-1", "export-1", "now", "req-1")
        check(result is RequestPersonalDataExportResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun requestPersonalDataExport_replaying_same_key_returns_identical_prior_result() {
        val store = InMemoryPersonalDataExportStore()
        val idempotencyStore = InMemoryExportIdempotencyStore()

        val first = requestPersonalDataExport("user-1", store, idempotencyStore, "key-1", "export-1", "now", "req-1")
        val second = requestPersonalDataExport("user-2", store, idempotencyStore, "key-1", "export-2", "later", "req-2")

        assertEquals(first, second)
        check(second is RequestPersonalDataExportResult.Queued)
        assertEquals("user-1", second.row.userId)
    }

    @Test fun requestPersonalDataExport_full_export_transition_chain_works_strictly_enforced() {
        val store = InMemoryPersonalDataExportStore()
        requestPersonalDataExport("user-1", store, InMemoryExportIdempotencyStore(), "key-1", "export-1", "now", "req-1")

        val processing = markPersonalDataExportProcessing("export-1", store, "req-1")
        check(processing is PersonalExportTransitionResult.Transitioned)

        val ready = markPersonalDataExportReady("export-1", "https://storage.example/export-1.json", "2026-10-10T00:00:00Z", store, "req-1")
        check(ready is PersonalExportTransitionResult.Transitioned)
        assertEquals(PersonalExportStatus.READY, ready.row.status)
        assertEquals("https://storage.example/export-1.json", ready.row.downloadUrl)
    }

    @Test fun markPersonalDataExportFailed_only_succeeds_from_PROCESSING() {
        val store = InMemoryPersonalDataExportStore()
        requestPersonalDataExport("user-1", store, InMemoryExportIdempotencyStore(), "key-1", "export-1", "now", "req-1")

        val tooEarly = markPersonalDataExportFailed("export-1", "renderer crashed", store, "req-1")
        check(tooEarly is PersonalExportTransitionResult.Rejected)
        assertEquals(409, tooEarly.problem.status)

        markPersonalDataExportProcessing("export-1", store, "req-1")
        val result = markPersonalDataExportFailed("export-1", "renderer crashed", store, "req-1")
        check(result is PersonalExportTransitionResult.Transitioned)
    }

    @Test fun getPersonalDataExport_404s_on_an_unknown_id() {
        val store = InMemoryPersonalDataExportStore()
        val result = getPersonalDataExport("no-such-export", store, "req-1")
        check(result is GetPersonalDataExportResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun requestAccountDeletion_marks_the_account_PROCESSING_on_first_request() {
        val store = InMemoryAccountDeletionStore()
        val idempotencyStore = InMemoryDeletionIdempotencyStore()

        val result = requestAccountDeletion("user-1", store, idempotencyStore, "key-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is RequestAccountDeletionResult.Processing)
        assertEquals(AccountDeletionStatus.PROCESSING, result.row.status)
        assertEquals("user-1", result.row.userId)
    }

    @Test fun requestAccountDeletion_missing_userId_is_schema_failure_400() {
        val store = InMemoryAccountDeletionStore()
        val result = requestAccountDeletion("", store, InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1")
        check(result is RequestAccountDeletionResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun requestAccountDeletion_replaying_same_key_returns_identical_prior_result() {
        val store = InMemoryAccountDeletionStore()
        val idempotencyStore = InMemoryDeletionIdempotencyStore()

        val first = requestAccountDeletion("user-1", store, idempotencyStore, "key-1", "now", "req-1")
        val second = requestAccountDeletion("user-1", store, idempotencyStore, "key-1", "much-later", "req-2")

        assertEquals(first, second)
    }

    @Test fun requestAccountDeletion_re_requesting_with_new_key_while_already_PROCESSING_is_safe_no_op() {
        val store = InMemoryAccountDeletionStore()
        requestAccountDeletion("user-1", store, InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1")

        val result = requestAccountDeletion("user-1", store, InMemoryDeletionIdempotencyStore(), "key-2", "later", "req-2")
        check(result is RequestAccountDeletionResult.Processing)
        assertEquals("now", result.row.requestedAt)
    }

    @Test fun requestAccountDeletion_re_requesting_after_COMPLETED_new_key_is_also_safe_no_op() {
        val store = InMemoryAccountDeletionStore()
        requestAccountDeletion("user-1", store, InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1")
        markAccountDeletionCompleted("user-1", "2026-10-05T00:00:00Z", store, "req-1")

        val result = requestAccountDeletion("user-1", store, InMemoryDeletionIdempotencyStore(), "key-2", "later", "req-2")
        check(result is RequestAccountDeletionResult.Processing)
        assertEquals(AccountDeletionStatus.COMPLETED, result.row.status)
    }

    @Test fun markAccountDeletionCompleted_PROCESSING_to_COMPLETED_succeeds() {
        val store = InMemoryAccountDeletionStore()
        requestAccountDeletion("user-1", store, InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1")

        val result = markAccountDeletionCompleted("user-1", "2026-10-05T00:00:00Z", store, "req-1")
        check(result is AccountDeletionTransitionResult.Transitioned)
        assertEquals(AccountDeletionStatus.COMPLETED, result.row.status)
        assertEquals("2026-10-05T00:00:00Z", result.row.completedAt)
    }

    @Test fun markAccountDeletionCompleted_404s_when_no_deletion_was_ever_requested() {
        val store = InMemoryAccountDeletionStore()
        val result = markAccountDeletionCompleted("no-such-user", "now", store, "req-1")
        check(result is AccountDeletionTransitionResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun markAccountDeletionCompleted_cannot_complete_an_already_COMPLETED_deletion_again_409() {
        val store = InMemoryAccountDeletionStore()
        requestAccountDeletion("user-1", store, InMemoryDeletionIdempotencyStore(), "key-1", "now", "req-1")
        markAccountDeletionCompleted("user-1", "2026-10-05T00:00:00Z", store, "req-1")

        val result = markAccountDeletionCompleted("user-1", "later", store, "req-1")
        check(result is AccountDeletionTransitionResult.Rejected)
        assertEquals(409, result.problem.status)
    }
}
