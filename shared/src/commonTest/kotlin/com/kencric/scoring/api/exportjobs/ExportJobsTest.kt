package com.kencric.scoring.api.exportjobs

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0116`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/exportJobs.test.ts` (`TASK-0103`) input-for-input.
 */
class ExportJobsTest {

    @Test fun createExportJob_valid_request_queues_a_new_job() {
        val store = InMemoryExportJobStore()
        val idempotencyStore = InMemoryIdempotencyStore()

        val result = createExportJob(
            CreateExportJobPayload(matchId = "match-1", format = "PDF", includeBranding = true),
            store,
            idempotencyStore,
            "key-1",
            "user-1",
            "export-1",
            "2026-10-03T00:00:00Z",
            "req-1",
        )

        check(result is CreateExportJobResult.Queued)
        assertEquals(ExportStatus.QUEUED, result.row.status)
        assertNull(result.row.downloadUrl)
        assertTrue(result.row.includeBranding)
        assertEquals("user-1", result.row.requestedBy)
    }

    @Test fun createExportJob_includeBranding_defaults_to_false_when_omitted() {
        val store = InMemoryExportJobStore()
        val result = createExportJob(CreateExportJobPayload(matchId = "match-1", format = "CSV"), store, InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1")
        check(result is CreateExportJobResult.Queued)
        assertEquals(false, result.row.includeBranding)
    }

    @Test fun createExportJob_missing_matchId_is_schema_failure_400() {
        val store = InMemoryExportJobStore()
        val result = createExportJob(CreateExportJobPayload(format = "PDF"), store, InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1")
        check(result is CreateExportJobResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun createExportJob_invalid_format_is_schema_failure_400() {
        val store = InMemoryExportJobStore()
        val result = createExportJob(CreateExportJobPayload(matchId = "match-1", format = "XLSX"), store, InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1")
        check(result is CreateExportJobResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun createExportJob_replaying_same_key_returns_identical_prior_result() {
        val store = InMemoryExportJobStore()
        val idempotencyStore = InMemoryIdempotencyStore()

        val first = createExportJob(CreateExportJobPayload(matchId = "match-1", format = "PDF"), store, idempotencyStore, "key-1", "user-1", "export-1", "now", "req-1")
        val second = createExportJob(CreateExportJobPayload(matchId = "match-2", format = "CSV"), store, idempotencyStore, "key-1", "user-2", "export-2", "later", "req-2")

        assertEquals(first, second)
        check(second is CreateExportJobResult.Queued)
        assertEquals("match-1", second.row.matchId)
        assertEquals("export-1", second.row.exportId)
    }

    @Test fun getExportJob_returns_row_when_it_exists() {
        val store = InMemoryExportJobStore()
        createExportJob(CreateExportJobPayload(matchId = "match-1", format = "PDF"), store, InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1")
        assertTrue(getExportJob("export-1", store, "req-1") is GetExportJobResult.Found)
    }

    @Test fun getExportJob_404s_on_an_unknown_id() {
        val store = InMemoryExportJobStore()
        val result = getExportJob("no-such-export", store, "req-1")
        check(result is GetExportJobResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    private fun queued(store: InMemoryExportJobStore): ExportJobRow {
        val result = createExportJob(CreateExportJobPayload(matchId = "match-1", format = "PDF"), store, InMemoryIdempotencyStore(), "key-1", "user-1", "export-1", "now", "req-1")
        check(result is CreateExportJobResult.Queued) { "seed failed" }
        return result.row
    }

    @Test fun stateMachine_QUEUED_to_PROCESSING_succeeds() {
        val store = InMemoryExportJobStore()
        queued(store)
        val result = markExportProcessing("export-1", store, "req-1")
        check(result is ExportJobTransitionResult.Transitioned)
        assertEquals(ExportStatus.PROCESSING, result.row.status)
    }

    @Test fun stateMachine_PROCESSING_to_READY_succeeds_with_download_details() {
        val store = InMemoryExportJobStore()
        queued(store)
        markExportProcessing("export-1", store, "req-1")
        val result = markExportReady("export-1", "https://storage.example/export-1.pdf", "2026-10-10T00:00:00Z", store, "req-1")
        check(result is ExportJobTransitionResult.Transitioned)
        assertEquals(ExportStatus.READY, result.row.status)
        assertEquals("https://storage.example/export-1.pdf", result.row.downloadUrl)
    }

    @Test fun stateMachine_PROCESSING_to_FAILED_succeeds_with_failure_reason() {
        val store = InMemoryExportJobStore()
        queued(store)
        markExportProcessing("export-1", store, "req-1")
        val result = markExportFailed("export-1", "renderer crashed", store, "req-1")
        check(result is ExportJobTransitionResult.Transitioned)
        assertEquals(ExportStatus.FAILED, result.row.status)
        assertEquals("renderer crashed", result.row.failureReason)
    }

    @Test fun stateMachine_QUEUED_to_READY_directly_is_rejected_409() {
        val store = InMemoryExportJobStore()
        queued(store)
        val result = markExportReady("export-1", "url", "later", store, "req-1")
        check(result is ExportJobTransitionResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun stateMachine_terminal_READY_cannot_be_reprocessed() {
        val store = InMemoryExportJobStore()
        queued(store)
        markExportProcessing("export-1", store, "req-1")
        markExportReady("export-1", "url", "later", store, "req-1")
        val result = markExportProcessing("export-1", store, "req-1")
        check(result is ExportJobTransitionResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun stateMachine_terminal_FAILED_cannot_be_marked_ready_afterward() {
        val store = InMemoryExportJobStore()
        queued(store)
        markExportProcessing("export-1", store, "req-1")
        markExportFailed("export-1", "renderer crashed", store, "req-1")
        val result = markExportReady("export-1", "url", "later", store, "req-1")
        check(result is ExportJobTransitionResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun stateMachine_404s_on_unknown_export_id_for_every_transition_function() {
        val store = InMemoryExportJobStore()
        assertTrue(markExportProcessing("no-such-export", store, "req-1") is ExportJobTransitionResult.Rejected)
        assertTrue(markExportReady("no-such-export", "url", "later", store, "req-1") is ExportJobTransitionResult.Rejected)
        assertTrue(markExportFailed("no-such-export", "reason", store, "req-1") is ExportJobTransitionResult.Rejected)
    }
}
