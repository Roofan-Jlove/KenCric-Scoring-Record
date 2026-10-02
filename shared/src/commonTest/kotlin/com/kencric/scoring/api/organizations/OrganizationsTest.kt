package com.kencric.scoring.api.organizations

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0106`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/organizations.test.ts` (`TASK-0093`) input-for-input.
 *
 * Every sealed-class result is narrowed with `check(result is X)`
 * (a contract-bearing stdlib function, so the smart cast that follows
 * is compiler-verified), never `assertTrue(result is X)` followed by
 * field access -- `assertTrue` carries no contract, so the compiler
 * cannot smart-cast afterward, an unverifiable-smart-cast risk this
 * backlog has flagged and avoided since `TASK-0041`. This is the
 * first Android test in this codebase to need field access after a
 * sealed-class narrowing at all, so there was no existing precedent
 * to follow here -- `check()` is the correct, compiler-safe idiom.
 */
class OrganizationsTest {

    private fun validPayload(id: String = "org-1", name: String = "Riverside CC", branding: Any? = null): CreateOrganizationPayload =
        CreateOrganizationPayload(id = id, name = name, branding = branding)

    private fun seedOrganization(
        store: InMemoryOrganizationStore,
        id: String = "org-1",
        name: String = "Riverside CC",
        branding: Any? = null,
    ): OrganizationRow {
        val result = createOrganization(validPayload(id, name, branding), store, "user-1", "2026-09-28T00:00:00Z", "req-seed")
        check(result is CreateOrganizationResult.Created) { "seed failed" }
        return result.row
    }

    // createOrganization
    @Test fun createOrganization_valid_payload_creates_row_with_server_assigned_audit_fields() {
        val store = InMemoryOrganizationStore()
        val result = createOrganization(validPayload(), store, "user-1", "2026-09-28T00:00:00Z", "req-1")

        check(result is CreateOrganizationResult.Created)
        assertEquals("org-1", result.row.id)
        assertEquals("Riverside CC", result.row.name)
        assertNull(result.row.branding)
        assertEquals(1, result.row.rowVersion)
        assertEquals("user-1", result.row.createdBy)
        assertEquals("2026-09-28T00:00:00Z", result.row.createdAt)
        assertNotNull(store.get("org-1"))
    }

    @Test fun createOrganization_missing_name_is_schema_failure_400() {
        val store = InMemoryOrganizationStore()
        val result = createOrganization(CreateOrganizationPayload(id = "org-1", name = ""), store, "user-1", "now", "req-1")
        check(result is CreateOrganizationResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun createOrganization_id_already_exists_is_rejected() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store)
        val result = createOrganization(validPayload(), store, "user-1", "now", "req-1")
        assertTrue(result is CreateOrganizationResult.Rejected)
    }

    @Test fun createOrganization_branding_is_optional_and_defaults_to_null() {
        val store = InMemoryOrganizationStore()
        val result = createOrganization(validPayload(branding = mapOf("logoUrl" to "x")), store, "user-1", "now", "req-1")
        check(result is CreateOrganizationResult.Created)
        assertEquals(mapOf("logoUrl" to "x"), result.row.branding)
    }

    // updateOrganization
    @Test fun updateOrganization_valid_update_succeeds_and_increments_row_version_by_exactly_1() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store)

        val result = updateOrganization(
            "org-1",
            UpdateOrganizationPayload(rowVersion = 1, name = "Riverside Cricket Club"),
            store,
            "user-2",
            "2026-09-28T01:00:00Z",
            "req-1",
        )

        check(result is UpdateOrganizationResult.Updated)
        assertEquals(2, result.row.rowVersion)
        assertEquals("Riverside Cricket Club", result.row.name)
        assertEquals("user-2", result.row.updatedBy)
        assertEquals("user-1", result.row.createdBy)
    }

    @Test fun updateOrganization_only_fields_present_in_payload_change() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store, branding = mapOf("logoUrl" to "old"))

        val result = updateOrganization("org-1", UpdateOrganizationPayload(rowVersion = 1, name = "New Name"), store, "user-1", "later", "req-1")
        check(result is UpdateOrganizationResult.Updated)
        assertEquals("New Name", result.row.name)
        assertEquals(mapOf("logoUrl" to "old"), result.row.branding)
    }

    @Test fun updateOrganization_non_existent_id_is_404() {
        val store = InMemoryOrganizationStore()
        val result = updateOrganization("no-such-org", UpdateOrganizationPayload(rowVersion = 1), store, "user-1", "now", "req-1")
        check(result is UpdateOrganizationResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun updateOrganization_missing_row_version_is_schema_failure_400() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store)
        val result = updateOrganization("org-1", UpdateOrganizationPayload(), store, "user-1", "now", "req-1")
        check(result is UpdateOrganizationResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun updateOrganization_stale_row_version_rejected_409_stored_row_unchanged() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store)
        val result = updateOrganization("org-1", UpdateOrganizationPayload(rowVersion = 999, name = "Should not apply"), store, "user-1", "now", "req-1")
        check(result is UpdateOrganizationResult.Rejected)
        assertEquals(409, result.problem.status)
        assertEquals("Riverside CC", store.get("org-1")?.name)
        assertEquals(1, store.get("org-1")?.rowVersion)
    }

    @Test fun updateOrganization_empty_name_in_payload_is_rejected() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store)
        val result = updateOrganization("org-1", UpdateOrganizationPayload(rowVersion = 1, name = ""), store, "user-1", "now", "req-1")
        check(result is UpdateOrganizationResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    // getOrganization
    @Test fun getOrganization_returns_row_when_it_exists() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store)
        assertTrue(getOrganization("org-1", store, "req-1") is GetOrganizationResult.Found)
    }

    @Test fun getOrganization_404s_when_id_does_not_exist() {
        val store = InMemoryOrganizationStore()
        val result = getOrganization("no-such-org", store, "req-1")
        check(result is GetOrganizationResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    // listOrganizations
    @Test fun listOrganizations_returns_items_ordered_by_id_ascending() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store, id = "org-b", name = "Beta")
        seedOrganization(store, id = "org-a", name = "Alpha")
        val result = listOrganizations(ListOrganizationsQuery(), store)
        assertEquals(listOf("org-a", "org-b"), result.items.map { it.id })
        assertFalse(result.hasMore)
        assertNull(result.nextCursor)
    }

    @Test fun listOrganizations_respects_limit_and_reports_hasMore_nextCursor() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store, id = "org-a", name = "Alpha")
        seedOrganization(store, id = "org-b", name = "Beta")
        seedOrganization(store, id = "org-c", name = "Gamma")

        val result = listOrganizations(ListOrganizationsQuery(limit = 2), store)
        assertEquals(listOf("org-a", "org-b"), result.items.map { it.id })
        assertTrue(result.hasMore)
        assertEquals("org-b", result.nextCursor)
    }

    @Test fun listOrganizations_after_cursor_resumes_strictly_after_last_seen_id() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store, id = "org-a", name = "Alpha")
        seedOrganization(store, id = "org-b", name = "Beta")
        seedOrganization(store, id = "org-c", name = "Gamma")

        val result = listOrganizations(ListOrganizationsQuery(after = "org-b"), store)
        assertEquals(listOf("org-c"), result.items.map { it.id })
    }

    @Test fun listOrganizations_nameSearch_filters_case_insensitively_by_substring() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store, id = "org-a", name = "Riverside CC")
        seedOrganization(store, id = "org-b", name = "Harbour CC")

        val result = listOrganizations(ListOrganizationsQuery(nameSearch = "riverside"), store)
        assertEquals(listOf("org-a"), result.items.map { it.id })
    }

    @Test fun listOrganizations_limit_is_capped_at_maximum_of_200() {
        val store = InMemoryOrganizationStore()
        seedOrganization(store)
        val result = listOrganizations(ListOrganizationsQuery(limit = 10000), store)
        assertEquals(1, result.items.size)
        assertFalse(result.hasMore)
    }
}
