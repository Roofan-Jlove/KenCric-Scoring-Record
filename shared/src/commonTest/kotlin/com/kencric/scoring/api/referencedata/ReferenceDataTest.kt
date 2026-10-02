package com.kencric.scoring.api.referencedata

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * `TASK-0113`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/referenceData.test.ts` (`TASK-0100`) input-for-input.
 */
class ReferenceDataTest {

    private fun validPayload(
        kind: String? = "CONDITIONS_PROFILE",
        version: Int? = 1,
        payload: Any? = mapOf("oversAllotted" to 20),
        publishedBy: String? = "platform-admin-1",
    ): PublishReferenceDataPayload = PublishReferenceDataPayload(kind = kind, version = version, payload = payload, publishedBy = publishedBy)

    @Test fun publishReferenceData_valid_first_publish_version_1_succeeds() {
        val store = InMemoryReferenceDataStore()
        val result = publishReferenceData(validPayload(), store, "2026-10-03T00:00:00Z", "req-1")

        check(result is PublishReferenceDataResult.Published)
        assertEquals(1, result.row.version)
        assertEquals("platform-admin-1", result.row.publishedBy)
        assertEquals("2026-10-03T00:00:00Z", result.row.publishedAt)
    }

    @Test fun publishReferenceData_invalid_kind_is_schema_failure_400() {
        val store = InMemoryReferenceDataStore()
        val result = publishReferenceData(validPayload(kind = "NOT_A_REAL_KIND"), store, "now", "req-1")
        check(result is PublishReferenceDataResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun publishReferenceData_missing_payload_is_schema_failure_400() {
        val store = InMemoryReferenceDataStore()
        val result = publishReferenceData(validPayload(payload = null), store, "now", "req-1")
        check(result is PublishReferenceDataResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun publishReferenceData_publishing_version_2_after_version_1_succeeds() {
        val store = InMemoryReferenceDataStore()
        publishReferenceData(validPayload(version = 1), store, "now", "req-1")
        val result = publishReferenceData(validPayload(version = 2), store, "later", "req-2")
        assertTrue(result is PublishReferenceDataResult.Published)
    }

    @Test fun publishReferenceData_re_publishing_already_published_version_is_409_never_silent_overwrite() {
        val store = InMemoryReferenceDataStore()
        publishReferenceData(validPayload(version = 1), store, "now", "req-1")
        val result = publishReferenceData(validPayload(version = 1), store, "later", "req-2")
        check(result is PublishReferenceDataResult.Rejected)
        assertEquals(409, result.problem.status)
        assertEquals("now", store.get("CONDITIONS_PROFILE", 1)?.publishedAt)
    }

    @Test fun publishReferenceData_version_that_skips_ahead_is_rejected_422() {
        val store = InMemoryReferenceDataStore()
        publishReferenceData(validPayload(version = 1), store, "now", "req-1")
        val result = publishReferenceData(validPayload(version = 5), store, "later", "req-2")
        check(result is PublishReferenceDataResult.Rejected)
        assertEquals(422, result.problem.status)
    }

    @Test fun publishReferenceData_version_not_required_to_start_at_1_for_a_different_kind() {
        val store = InMemoryReferenceDataStore()
        publishReferenceData(validPayload(kind = "CONDITIONS_PROFILE", version = 1), store, "now", "req-1")
        val result = publishReferenceData(validPayload(kind = "DLS_TABLE", version = 1), store, "now", "req-2")
        assertTrue(result is PublishReferenceDataResult.Published)
    }

    @Test fun getReferenceData_returns_exact_version_when_it_exists() {
        val store = InMemoryReferenceDataStore()
        publishReferenceData(validPayload(version = 1), store, "now", "req-1")
        assertTrue(getReferenceData("CONDITIONS_PROFILE", 1, store, "req-1") is GetReferenceDataResult.Found)
    }

    @Test fun getReferenceData_404s_when_that_version_does_not_exist() {
        val store = InMemoryReferenceDataStore()
        val result = getReferenceData("CONDITIONS_PROFILE", 1, store, "req-1")
        check(result is GetReferenceDataResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun listReferenceData_returns_every_version_for_a_kind_oldest_first() {
        val store = InMemoryReferenceDataStore()
        publishReferenceData(validPayload(version = 1), store, "now", "req-1")
        publishReferenceData(validPayload(version = 2), store, "later", "req-2")
        val result = listReferenceData("CONDITIONS_PROFILE", store)
        assertEquals(listOf(1, 2), result.map { it.version })
    }

    @Test fun listReferenceData_never_mixes_kinds() {
        val store = InMemoryReferenceDataStore()
        publishReferenceData(validPayload(kind = "CONDITIONS_PROFILE", version = 1), store, "now", "req-1")
        publishReferenceData(validPayload(kind = "DLS_TABLE", version = 1), store, "now", "req-2")
        assertEquals(1, listReferenceData("CONDITIONS_PROFILE", store).size)
        assertEquals(1, listReferenceData("DLS_TABLE", store).size)
    }

    @Test fun getLatestReferenceData_returns_highest_version_row_for_a_kind() {
        val store = InMemoryReferenceDataStore()
        publishReferenceData(validPayload(version = 1), store, "now", "req-1")
        publishReferenceData(validPayload(version = 2), store, "later", "req-2")
        publishReferenceData(validPayload(version = 3), store, "latest", "req-3")

        val result = getLatestReferenceData("CONDITIONS_PROFILE", store, "req-1")
        check(result is GetLatestReferenceDataResult.Found)
        assertEquals(3, result.row.version)
    }

    @Test fun getLatestReferenceData_404s_when_nothing_ever_published_for_that_kind() {
        val store = InMemoryReferenceDataStore()
        val result = getLatestReferenceData("APP_CONFIG", store, "req-1")
        check(result is GetLatestReferenceDataResult.Rejected)
        assertEquals(404, result.problem.status)
    }
}
