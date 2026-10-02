package com.kencric.scoring.api.deactivatemember

import com.kencric.scoring.api.memberships.CreateMembershipPayload
import com.kencric.scoring.api.memberships.CreateMembershipResult
import com.kencric.scoring.api.memberships.InMemoryMembershipStore
import com.kencric.scoring.api.memberships.MembershipRow
import com.kencric.scoring.api.memberships.MembershipStatus
import com.kencric.scoring.api.memberships.createMembership
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0114`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/deactivateMember.test.ts` (`TASK-0101`)
 * input-for-input.
 */
class DeactivateMemberTest {

    private fun seedMembership(store: InMemoryMembershipStore): MembershipRow {
        val result = createMembership(
            CreateMembershipPayload(id = "mem-1", userId = "user-1", organizationId = "org-1", roles = listOf("HEAD_SCORER")),
            store,
            "admin-1",
            "2026-10-03T00:00:00Z",
            "req-seed",
        )
        check(result is CreateMembershipResult.Created) { "seed failed" }
        return result.row
    }

    @Test fun deactivateMember_sets_status_to_DEACTIVATED_and_bumps_row_version() {
        val membershipStore = InMemoryMembershipStore()
        val idempotencyStore = InMemoryIdempotencyStore()
        seedMembership(membershipStore)

        val result = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-2", "later", "req-1")

        check(result is DeactivateMemberResult.Deactivated)
        assertEquals(MembershipStatus.DEACTIVATED, result.row.status)
        assertEquals(2, result.row.rowVersion)
        assertEquals("admin-2", result.row.updatedBy)
        assertEquals(listOf("HEAD_SCORER"), result.row.roles)
    }

    @Test fun deactivateMember_404s_on_a_missing_membership() {
        val membershipStore = InMemoryMembershipStore()
        val idempotencyStore = InMemoryIdempotencyStore()

        val result = deactivateMember("no-such-mem", "key-1", membershipStore, idempotencyStore, "admin-1", "now", "req-1")
        check(result is DeactivateMemberResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun deactivateMember_replaying_same_key_returns_identical_prior_result() {
        val membershipStore = InMemoryMembershipStore()
        val idempotencyStore = InMemoryIdempotencyStore()
        seedMembership(membershipStore)

        val first = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-2", "2026-10-03T01:00:00Z", "req-1")
        val second = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-3", "much-later", "req-2")

        assertEquals(first, second)
        check(second is DeactivateMemberResult.Deactivated)
        assertEquals("admin-2", second.row.updatedBy)
        assertEquals(2, second.row.rowVersion)
    }

    @Test fun deactivateMember_a_key_that_previously_failed_is_reprocessed_fresh_on_retry() {
        val membershipStore = InMemoryMembershipStore()
        val idempotencyStore = InMemoryIdempotencyStore()

        val first = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-1", "now", "req-1")
        check(first is DeactivateMemberResult.Rejected)

        seedMembership(membershipStore)
        val second = deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-1", "later", "req-2")
        check(second is DeactivateMemberResult.Deactivated)
    }

    @Test fun deactivateMember_already_deactivated_is_a_safe_no_op_not_an_error() {
        val membershipStore = InMemoryMembershipStore()
        seedMembership(membershipStore)

        deactivateMember("mem-1", "key-1", membershipStore, InMemoryIdempotencyStore(), "admin-1", "now", "req-1")

        val result = deactivateMember("mem-1", "key-2", membershipStore, InMemoryIdempotencyStore(), "admin-2", "later", "req-2")
        check(result is DeactivateMemberResult.Deactivated)
        assertEquals(MembershipStatus.DEACTIVATED, result.row.status)
        assertEquals(2, result.row.rowVersion)
    }

    @Test fun deactivateMember_different_keys_each_process_independently_when_first_hasnt_happened() {
        val membershipStore = InMemoryMembershipStore()
        val idempotencyStore = InMemoryIdempotencyStore()
        seedMembership(membershipStore)

        deactivateMember("mem-1", "key-1", membershipStore, idempotencyStore, "admin-1", "now", "req-1")
        val result = deactivateMember("mem-1", "key-2", membershipStore, idempotencyStore, "admin-2", "later", "req-2")

        check(result is DeactivateMemberResult.Deactivated)
        assertEquals(2, result.row.rowVersion)
    }
}
