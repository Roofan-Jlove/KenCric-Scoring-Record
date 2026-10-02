package com.kencric.scoring.api.teams

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0107`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/teams.test.ts` (`TASK-0094`) input-for-input. Every
 * sealed-class result is narrowed with `check(result is X)`, never
 * `assertTrue` followed by field access -- see `OrganizationsTest.kt`
 * (`TASK-0106`) for why.
 */
class TeamsTest {

    private fun validPayload(
        id: String = "team-1",
        organizationId: String? = "org-1",
        name: String = "Riverside CC",
        canonicalRef: String? = null,
    ): CreateTeamPayload = CreateTeamPayload(id = id, organizationId = organizationId, name = name, canonicalRef = canonicalRef)

    private fun seedTeam(
        store: InMemoryTeamStore,
        id: String = "team-1",
        organizationId: String? = "org-1",
        name: String = "Riverside CC",
        canonicalRef: String? = null,
    ): TeamRow {
        val result = createTeam(validPayload(id, organizationId, name, canonicalRef), store, "user-1", "2026-09-28T00:00:00Z", "req-seed")
        check(result is CreateTeamResult.Created) { "seed failed" }
        return result.row
    }

    // createTeam
    @Test fun createTeam_valid_payload_creates_row_with_server_assigned_audit_fields() {
        val store = InMemoryTeamStore()
        val result = createTeam(validPayload(), store, "user-1", "2026-09-28T00:00:00Z", "req-1")

        check(result is CreateTeamResult.Created)
        assertEquals("team-1", result.row.id)
        assertEquals("org-1", result.row.organizationId)
        assertNull(result.row.canonicalRef)
        assertEquals(1, result.row.rowVersion)
        assertEquals("user-1", result.row.createdBy)
    }

    @Test fun createTeam_null_organizationId_creates_ad_hoc_team() {
        val store = InMemoryTeamStore()
        val result = createTeam(validPayload(organizationId = null), store, "user-1", "now", "req-1")
        check(result is CreateTeamResult.Created)
        assertNull(result.row.organizationId)
    }

    @Test fun createTeam_missing_name_is_schema_failure_400() {
        val store = InMemoryTeamStore()
        val result = createTeam(CreateTeamPayload(id = "team-1", name = ""), store, "user-1", "now", "req-1")
        check(result is CreateTeamResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun createTeam_id_already_exists_is_rejected() {
        val store = InMemoryTeamStore()
        seedTeam(store)
        val result = createTeam(validPayload(), store, "user-1", "now", "req-1")
        assertTrue(result is CreateTeamResult.Rejected)
    }

    // updateTeam
    @Test fun updateTeam_valid_update_succeeds_and_increments_row_version_by_exactly_1() {
        val store = InMemoryTeamStore()
        seedTeam(store)
        val result = updateTeam("team-1", UpdateTeamPayload(rowVersion = 1, name = "Riverside Cricket Club"), store, "user-2", "later", "req-1")
        check(result is UpdateTeamResult.Updated)
        assertEquals(2, result.row.rowVersion)
        assertEquals("Riverside Cricket Club", result.row.name)
    }

    @Test fun updateTeam_only_fields_present_in_payload_change() {
        val store = InMemoryTeamStore()
        seedTeam(store, canonicalRef = "canon-1")
        val result = updateTeam("team-1", UpdateTeamPayload(rowVersion = 1, name = "New Name"), store, "user-1", "later", "req-1")
        check(result is UpdateTeamResult.Updated)
        assertEquals("New Name", result.row.name)
        assertEquals("canon-1", result.row.canonicalRef)
    }

    @Test fun updateTeam_non_existent_id_is_404() {
        val store = InMemoryTeamStore()
        val result = updateTeam("no-such-team", UpdateTeamPayload(rowVersion = 1), store, "user-1", "now", "req-1")
        check(result is UpdateTeamResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun updateTeam_missing_row_version_is_schema_failure_400() {
        val store = InMemoryTeamStore()
        seedTeam(store)
        val result = updateTeam("team-1", UpdateTeamPayload(), store, "user-1", "now", "req-1")
        check(result is UpdateTeamResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun updateTeam_stale_row_version_rejected_409_stored_row_unchanged() {
        val store = InMemoryTeamStore()
        seedTeam(store)
        val result = updateTeam("team-1", UpdateTeamPayload(rowVersion = 999, name = "Should not apply"), store, "user-1", "now", "req-1")
        check(result is UpdateTeamResult.Rejected)
        assertEquals(409, result.problem.status)
        assertEquals("Riverside CC", store.get("team-1")?.name)
    }

    // getTeam
    @Test fun getTeam_returns_row_when_it_exists() {
        val store = InMemoryTeamStore()
        seedTeam(store)
        assertTrue(getTeam("team-1", store, "req-1") is GetTeamResult.Found)
    }

    @Test fun getTeam_404s_when_id_does_not_exist() {
        val store = InMemoryTeamStore()
        val result = getTeam("no-such-team", store, "req-1")
        check(result is GetTeamResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    // listTeams
    @Test fun listTeams_returns_items_ordered_by_id_ascending() {
        val store = InMemoryTeamStore()
        seedTeam(store, id = "team-b", name = "Beta")
        seedTeam(store, id = "team-a", name = "Alpha")
        val result = listTeams(ListTeamsQuery(), store)
        assertEquals(listOf("team-a", "team-b"), result.items.map { it.id })
    }

    @Test fun listTeams_filters_by_organizationId() {
        val store = InMemoryTeamStore()
        seedTeam(store, id = "team-a", organizationId = "org-1")
        seedTeam(store, id = "team-b", organizationId = "org-2")
        val result = listTeams(ListTeamsQuery(organizationId = "org-1"), store)
        assertEquals(listOf("team-a"), result.items.map { it.id })
    }

    @Test fun listTeams_filters_by_nameSearch_case_insensitively() {
        val store = InMemoryTeamStore()
        seedTeam(store, id = "team-a", name = "Riverside CC")
        seedTeam(store, id = "team-b", name = "Harbour CC")
        val result = listTeams(ListTeamsQuery(nameSearch = "riverside"), store)
        assertEquals(listOf("team-a"), result.items.map { it.id })
    }

    @Test fun listTeams_respects_limit_and_reports_hasMore_nextCursor() {
        val store = InMemoryTeamStore()
        seedTeam(store, id = "team-a")
        seedTeam(store, id = "team-b")
        seedTeam(store, id = "team-c")
        val result = listTeams(ListTeamsQuery(limit = 2), store)
        assertEquals(listOf("team-a", "team-b"), result.items.map { it.id })
        assertTrue(result.hasMore)
        assertEquals("team-b", result.nextCursor)
    }

    // deleteTeam
    @Test fun deleteTeam_404s_when_id_does_not_exist() {
        val store = InMemoryTeamStore()
        val result = deleteTeam("no-such-team", store, "user-1", "req-1")
        check(result is DeleteTeamResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun deleteTeam_refuses_422_a_team_with_match_history_regardless_of_who_asks() {
        val store = InMemoryTeamStore()
        seedTeam(store)
        store.markHasMatchHistory("team-1")
        val result = deleteTeam("team-1", store, "user-1", "req-1")
        check(result is DeleteTeamResult.Rejected)
        assertEquals(422, result.problem.status)
        assertNotNull(store.get("team-1"))
    }

    @Test fun deleteTeam_refuses_403_a_caller_who_is_not_the_creator_even_with_no_match_history() {
        val store = InMemoryTeamStore()
        seedTeam(store)
        val result = deleteTeam("team-1", store, "someone-else", "req-1")
        check(result is DeleteTeamResult.Rejected)
        assertEquals(403, result.problem.status)
        assertNotNull(store.get("team-1"))
    }

    @Test fun deleteTeam_succeeds_for_the_teams_own_creator_with_no_match_history() {
        val store = InMemoryTeamStore()
        seedTeam(store)
        val result = deleteTeam("team-1", store, "user-1", "req-1")
        assertTrue(result is DeleteTeamResult.Deleted)
        assertNull(store.get("team-1"))
    }

    @Test fun deleteTeam_checks_match_history_before_authorship() {
        val store = InMemoryTeamStore()
        seedTeam(store)
        store.markHasMatchHistory("team-1")
        val result = deleteTeam("team-1", store, "user-1", "req-1")
        check(result is DeleteTeamResult.Rejected)
        assertEquals(422, result.problem.status)
    }
}
