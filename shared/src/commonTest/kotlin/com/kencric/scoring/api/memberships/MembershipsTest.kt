package com.kencric.scoring.api.memberships

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * `TASK-0108`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/memberships.test.ts` (`TASK-0095`) input-for-input.
 */
class MembershipsTest {

    private fun validPayload(
        id: String = "mem-1",
        userId: String = "user-1",
        organizationId: String = "org-1",
        roles: List<String>? = null,
    ): CreateMembershipPayload = CreateMembershipPayload(id = id, userId = userId, organizationId = organizationId, roles = roles)

    private fun seedMembership(
        store: InMemoryMembershipStore,
        id: String = "mem-1",
        userId: String = "user-1",
        organizationId: String = "org-1",
        roles: List<String>? = null,
    ): MembershipRow {
        val result = createMembership(validPayload(id, userId, organizationId, roles), store, "admin-1", "2026-10-03T00:00:00Z", "req-seed")
        check(result is CreateMembershipResult.Created) { "seed failed" }
        return result.row
    }

    // createMembership
    @Test fun createMembership_valid_payload_creates_row_always_ACTIVE() {
        val store = InMemoryMembershipStore()
        val result = createMembership(validPayload(), store, "admin-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is CreateMembershipResult.Created)
        assertEquals(MembershipStatus.ACTIVE, result.row.status)
        assertEquals(emptyList(), result.row.roles)
        assertEquals(1, result.row.rowVersion)
        assertEquals("admin-1", result.row.createdBy)
    }

    @Test fun createMembership_accepts_a_valid_roles_array() {
        val store = InMemoryMembershipStore()
        val result = createMembership(validPayload(roles = listOf("HEAD_SCORER", "TEAM_MANAGER")), store, "admin-1", "now", "req-1")
        check(result is CreateMembershipResult.Created)
        assertEquals(listOf("HEAD_SCORER", "TEAM_MANAGER"), result.row.roles)
    }

    @Test fun createMembership_rejects_an_invalid_role_422() {
        val store = InMemoryMembershipStore()
        val result = createMembership(validPayload(roles = listOf("NOT_A_REAL_ROLE")), store, "admin-1", "now", "req-1")
        check(result is CreateMembershipResult.Rejected)
        assertEquals(422, result.problem.status)
    }

    @Test fun createMembership_missing_userId_is_schema_failure_400() {
        val store = InMemoryMembershipStore()
        val result = createMembership(CreateMembershipPayload(id = "mem-1", userId = "", organizationId = "org-1"), store, "admin-1", "now", "req-1")
        check(result is CreateMembershipResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun createMembership_id_already_exists_is_rejected() {
        val store = InMemoryMembershipStore()
        seedMembership(store)
        val result = createMembership(validPayload(), store, "admin-1", "now", "req-1")
        assertTrue(result is CreateMembershipResult.Rejected)
    }

    @Test fun createMembership_rejects_second_membership_same_user_org_pair_different_id() {
        val store = InMemoryMembershipStore()
        seedMembership(store)
        val result = createMembership(validPayload(id = "mem-2"), store, "admin-1", "now", "req-1")
        check(result is CreateMembershipResult.Rejected)
        assertEquals(422, result.problem.status)
    }

    @Test fun createMembership_same_user_in_different_organization_is_allowed() {
        val store = InMemoryMembershipStore()
        seedMembership(store)
        val result = createMembership(validPayload(id = "mem-2", organizationId = "org-2"), store, "admin-1", "now", "req-1")
        assertTrue(result is CreateMembershipResult.Created)
    }

    // updateMembership
    @Test fun updateMembership_valid_roles_update_succeeds_increments_row_version() {
        val store = InMemoryMembershipStore()
        seedMembership(store)
        val result = updateMembership("mem-1", UpdateMembershipPayload(rowVersion = 1, roles = listOf("UMPIRE"), rolesSet = true), store, "admin-2", "later", "req-1")
        check(result is UpdateMembershipResult.Updated)
        assertEquals(listOf("UMPIRE"), result.row.roles)
        assertEquals(2, result.row.rowVersion)
        assertEquals(MembershipStatus.ACTIVE, result.row.status)
    }

    @Test fun updateMembership_rejects_an_invalid_role_on_update_422() {
        val store = InMemoryMembershipStore()
        seedMembership(store)
        val result = updateMembership("mem-1", UpdateMembershipPayload(rowVersion = 1, roles = listOf("NOT_A_REAL_ROLE"), rolesSet = true), store, "admin-1", "now", "req-1")
        check(result is UpdateMembershipResult.Rejected)
        assertEquals(422, result.problem.status)
    }

    @Test fun updateMembership_non_existent_id_is_404() {
        val store = InMemoryMembershipStore()
        val result = updateMembership("no-such-mem", UpdateMembershipPayload(rowVersion = 1), store, "admin-1", "now", "req-1")
        check(result is UpdateMembershipResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun updateMembership_missing_row_version_is_schema_failure_400() {
        val store = InMemoryMembershipStore()
        seedMembership(store)
        val result = updateMembership("mem-1", UpdateMembershipPayload(), store, "admin-1", "now", "req-1")
        check(result is UpdateMembershipResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun updateMembership_stale_row_version_rejected_409_stored_row_unchanged() {
        val store = InMemoryMembershipStore()
        seedMembership(store, roles = listOf("VIEWER"))
        val result = updateMembership("mem-1", UpdateMembershipPayload(rowVersion = 999, roles = listOf("PLATFORM_ADMIN"), rolesSet = true), store, "admin-1", "now", "req-1")
        check(result is UpdateMembershipResult.Rejected)
        assertEquals(409, result.problem.status)
        assertEquals(listOf("VIEWER"), store.get("mem-1")?.roles)
    }

    @Test fun updateMembership_has_no_way_to_set_status_the_type_has_no_such_field() {
        val store = InMemoryMembershipStore()
        seedMembership(store)
        // UpdateMembershipPayload structurally has no `status` field at all -- see its own doc comment.
        val payload = UpdateMembershipPayload(rowVersion = 1)
        val result = updateMembership("mem-1", payload, store, "admin-1", "now", "req-1")
        check(result is UpdateMembershipResult.Updated)
        assertEquals(MembershipStatus.ACTIVE, result.row.status)
    }

    // getMembership
    @Test fun getMembership_returns_row_when_it_exists() {
        val store = InMemoryMembershipStore()
        seedMembership(store)
        assertTrue(getMembership("mem-1", store, "req-1") is GetMembershipResult.Found)
    }

    @Test fun getMembership_404s_when_id_does_not_exist() {
        val store = InMemoryMembershipStore()
        val result = getMembership("no-such-mem", store, "req-1")
        check(result is GetMembershipResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    // listMemberships
    @Test fun listMemberships_returns_items_ordered_by_id_ascending() {
        val store = InMemoryMembershipStore()
        seedMembership(store, id = "mem-b", userId = "user-b")
        seedMembership(store, id = "mem-a", userId = "user-a")
        val result = listMemberships(ListMembershipsQuery(), store)
        assertEquals(listOf("mem-a", "mem-b"), result.items.map { it.id })
    }

    @Test fun listMemberships_filters_by_organizationId() {
        val store = InMemoryMembershipStore()
        seedMembership(store, id = "mem-a", userId = "user-a", organizationId = "org-1")
        seedMembership(store, id = "mem-b", userId = "user-b", organizationId = "org-2")
        val result = listMemberships(ListMembershipsQuery(organizationId = "org-1"), store)
        assertEquals(listOf("mem-a"), result.items.map { it.id })
    }

    @Test fun listMemberships_filters_by_userId() {
        val store = InMemoryMembershipStore()
        seedMembership(store, id = "mem-a", userId = "user-a", organizationId = "org-1")
        seedMembership(store, id = "mem-b", userId = "user-b", organizationId = "org-1")
        val result = listMemberships(ListMembershipsQuery(userId = "user-b"), store)
        assertEquals(listOf("mem-b"), result.items.map { it.id })
    }

    @Test fun listMemberships_filters_by_status() {
        val store = InMemoryMembershipStore()
        seedMembership(store, id = "mem-a", userId = "user-a")
        val result = listMemberships(ListMembershipsQuery(status = MembershipStatus.ACTIVE), store)
        assertEquals(listOf("mem-a"), result.items.map { it.id })
        assertEquals(emptyList(), listMemberships(ListMembershipsQuery(status = MembershipStatus.DEACTIVATED), store).items)
    }

    @Test fun listMemberships_respects_limit_and_reports_hasMore_nextCursor() {
        val store = InMemoryMembershipStore()
        seedMembership(store, id = "mem-a", userId = "user-a")
        seedMembership(store, id = "mem-b", userId = "user-b")
        seedMembership(store, id = "mem-c", userId = "user-c")
        val result = listMemberships(ListMembershipsQuery(limit = 2), store)
        assertEquals(listOf("mem-a", "mem-b"), result.items.map { it.id })
        assertTrue(result.hasMore)
        assertEquals("mem-b", result.nextCursor)
    }
}
