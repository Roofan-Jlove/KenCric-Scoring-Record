package com.kencric.scoring.api.officials

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0111`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/officials.test.ts` (`TASK-0098`) input-for-input.
 */
class OfficialsTest {

    private fun validPayload(id: String = "official-1", organizationId: String? = "org-1", name: String = "Jordan Lee", userId: String? = null): CreateOfficialPayload =
        CreateOfficialPayload(id = id, organizationId = organizationId, name = name, userId = userId)

    private fun seedOfficial(
        store: InMemoryOfficialStore,
        id: String = "official-1",
        organizationId: String? = "org-1",
        name: String = "Jordan Lee",
        userId: String? = null,
    ): OfficialRow {
        val result = createOfficial(validPayload(id, organizationId, name, userId), store, "user-1", "2026-10-03T00:00:00Z", "req-seed")
        check(result is CreateOfficialResult.Created) { "seed failed" }
        return result.row
    }

    // createOfficial
    @Test fun createOfficial_valid_payload_creates_row_with_server_assigned_audit_fields() {
        val store = InMemoryOfficialStore()
        val result = createOfficial(validPayload(), store, "user-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is CreateOfficialResult.Created)
        assertEquals("official-1", result.row.id)
        assertNull(result.row.userId)
        assertEquals(1, result.row.rowVersion)
        assertEquals("user-1", result.row.createdBy)
    }

    @Test fun createOfficial_accepts_optional_userId() {
        val store = InMemoryOfficialStore()
        val result = createOfficial(validPayload(userId = "user-42"), store, "user-1", "now", "req-1")
        check(result is CreateOfficialResult.Created)
        assertEquals("user-42", result.row.userId)
    }

    @Test fun createOfficial_missing_name_is_schema_failure_400() {
        val store = InMemoryOfficialStore()
        val result = createOfficial(CreateOfficialPayload(id = "official-1", name = ""), store, "user-1", "now", "req-1")
        check(result is CreateOfficialResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun createOfficial_id_already_exists_is_rejected() {
        val store = InMemoryOfficialStore()
        seedOfficial(store)
        val result = createOfficial(validPayload(), store, "user-1", "now", "req-1")
        assertTrue(result is CreateOfficialResult.Rejected)
    }

    // updateOfficial
    @Test fun updateOfficial_valid_update_succeeds_and_increments_row_version_by_exactly_1() {
        val store = InMemoryOfficialStore()
        seedOfficial(store)
        val result = updateOfficial("official-1", UpdateOfficialPayload(rowVersion = 1, name = "Jordan A. Lee"), store, "user-2", "later", "req-1")
        check(result is UpdateOfficialResult.Updated)
        assertEquals("Jordan A. Lee", result.row.name)
        assertEquals(2, result.row.rowVersion)
    }

    @Test fun updateOfficial_only_fields_present_in_payload_change() {
        val store = InMemoryOfficialStore()
        seedOfficial(store, userId = "user-42")
        val result = updateOfficial("official-1", UpdateOfficialPayload(rowVersion = 1, name = "New Name"), store, "user-1", "later", "req-1")
        check(result is UpdateOfficialResult.Updated)
        assertEquals("New Name", result.row.name)
        assertEquals("user-42", result.row.userId)
    }

    @Test fun updateOfficial_non_existent_id_is_404() {
        val store = InMemoryOfficialStore()
        val result = updateOfficial("no-such-official", UpdateOfficialPayload(rowVersion = 1), store, "user-1", "now", "req-1")
        check(result is UpdateOfficialResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun updateOfficial_missing_row_version_is_schema_failure_400() {
        val store = InMemoryOfficialStore()
        seedOfficial(store)
        val result = updateOfficial("official-1", UpdateOfficialPayload(), store, "user-1", "now", "req-1")
        check(result is UpdateOfficialResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun updateOfficial_stale_row_version_rejected_409_stored_row_unchanged() {
        val store = InMemoryOfficialStore()
        seedOfficial(store)
        val result = updateOfficial("official-1", UpdateOfficialPayload(rowVersion = 999, name = "Should not apply"), store, "user-1", "now", "req-1")
        check(result is UpdateOfficialResult.Rejected)
        assertEquals(409, result.problem.status)
        assertEquals("Jordan Lee", store.get("official-1")?.name)
    }

    // getOfficial
    @Test fun getOfficial_returns_row_when_it_exists() {
        val store = InMemoryOfficialStore()
        seedOfficial(store)
        assertTrue(getOfficial("official-1", store, "req-1") is GetOfficialResult.Found)
    }

    @Test fun getOfficial_404s_when_id_does_not_exist() {
        val store = InMemoryOfficialStore()
        val result = getOfficial("no-such-official", store, "req-1")
        check(result is GetOfficialResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    // listOfficials
    @Test fun listOfficials_returns_items_ordered_by_id_ascending() {
        val store = InMemoryOfficialStore()
        seedOfficial(store, id = "official-b")
        seedOfficial(store, id = "official-a")
        val result = listOfficials(ListOfficialsQuery(), store)
        assertEquals(listOf("official-a", "official-b"), result.items.map { it.id })
    }

    @Test fun listOfficials_filters_by_organizationId() {
        val store = InMemoryOfficialStore()
        seedOfficial(store, id = "official-a", organizationId = "org-1")
        seedOfficial(store, id = "official-b", organizationId = "org-2")
        val result = listOfficials(ListOfficialsQuery(organizationId = "org-1"), store)
        assertEquals(listOf("official-a"), result.items.map { it.id })
    }

    @Test fun listOfficials_respects_limit_and_reports_hasMore_nextCursor() {
        val store = InMemoryOfficialStore()
        seedOfficial(store, id = "official-a")
        seedOfficial(store, id = "official-b")
        seedOfficial(store, id = "official-c")
        val result = listOfficials(ListOfficialsQuery(limit = 2), store)
        assertEquals(listOf("official-a", "official-b"), result.items.map { it.id })
        assertTrue(result.hasMore)
        assertEquals("official-b", result.nextCursor)
    }

    // deleteOfficial
    @Test fun deleteOfficial_404s_when_id_does_not_exist() {
        val store = InMemoryOfficialStore()
        val result = deleteOfficial("no-such-official", store, "req-1")
        check(result is DeleteOfficialResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun deleteOfficial_refuses_422_an_official_with_a_match_assignment() {
        val store = InMemoryOfficialStore()
        seedOfficial(store)
        store.markHasMatchAssignment("official-1")
        val result = deleteOfficial("official-1", store, "req-1")
        check(result is DeleteOfficialResult.Rejected)
        assertEquals(422, result.problem.status)
        assertNotNull(store.get("official-1"))
    }

    @Test fun deleteOfficial_succeeds_for_a_never_assigned_official_with_no_authorship_restriction() {
        val store = InMemoryOfficialStore()
        seedOfficial(store)
        val result = deleteOfficial("official-1", store, "req-1")
        assertTrue(result is DeleteOfficialResult.Deleted)
        assertNull(store.get("official-1"))
    }
}
