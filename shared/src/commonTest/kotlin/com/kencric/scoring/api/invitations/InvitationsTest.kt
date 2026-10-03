package com.kencric.scoring.api.invitations

import com.kencric.scoring.api.memberships.InMemoryMembershipStore
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0126`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/invitations.test.ts` (`TASK-0120`) input-for-input.
 */
class InvitationsTest {

    @Test fun inviteMember_sends_a_new_invitation() {
        val store = InMemoryInvitationStore()
        val payload = InviteMemberPayload(organizationId = "org-1", email = "new@example.com", roles = listOf("UMPIRE"), expiresAt = "2026-10-10T00:00:00Z")

        val result = inviteMember(payload, store, "admin-1", "inv-1", "token-1", "2026-10-03T00:00:00Z", "req-1")

        check(result is InviteMemberResult.Sent)
        assertEquals(InvitationStatus.PENDING, result.row.status)
        assertEquals("token-1", result.row.token)
        assertNull(result.row.acceptedAt)
    }

    @Test fun inviteMember_defaults_roles_to_empty_array_when_omitted() {
        val store = InMemoryInvitationStore()
        val result = inviteMember(InviteMemberPayload(organizationId = "org-1", email = "new@example.com", expiresAt = "later"), store, "admin-1", "inv-1", "token-1", "now", "req-1")
        check(result is InviteMemberResult.Sent)
        assertEquals(emptyList(), result.row.roles)
    }

    @Test fun inviteMember_missing_organizationId_is_schema_failure_400() {
        val store = InMemoryInvitationStore()
        val result = inviteMember(InviteMemberPayload(email = "new@example.com", expiresAt = "later"), store, "admin-1", "inv-1", "token-1", "now", "req-1")
        check(result is InviteMemberResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun inviteMember_missing_email_is_schema_failure_400() {
        val store = InMemoryInvitationStore()
        val result = inviteMember(InviteMemberPayload(organizationId = "org-1", expiresAt = "later"), store, "admin-1", "inv-1", "token-1", "now", "req-1")
        check(result is InviteMemberResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun inviteMember_missing_expiresAt_is_schema_failure_400() {
        val store = InMemoryInvitationStore()
        val result = inviteMember(InviteMemberPayload(organizationId = "org-1", email = "new@example.com"), store, "admin-1", "inv-1", "token-1", "now", "req-1")
        check(result is InviteMemberResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun inviteMember_invalid_role_is_business_rule_failure_422() {
        val store = InMemoryInvitationStore()
        val result = inviteMember(
            InviteMemberPayload(organizationId = "org-1", email = "new@example.com", roles = listOf("NOT_A_ROLE"), expiresAt = "later"),
            store, "admin-1", "inv-1", "token-1", "now", "req-1",
        )
        check(result is InviteMemberResult.Rejected)
        assertEquals(422, result.problem.status)
    }

    private fun sentInvitation(invitationStore: InMemoryInvitationStore, expiresAt: String = "2026-10-10T00:00:00Z"): InvitationRow {
        val result = inviteMember(
            InviteMemberPayload(organizationId = "org-1", email = "new@example.com", roles = listOf("UMPIRE"), expiresAt = expiresAt),
            invitationStore, "admin-1", "inv-1", "token-1", "2026-10-03T00:00:00Z", "req-1",
        )
        check(result is InviteMemberResult.Sent) { "seed failed" }
        return result.row
    }

    @Test fun acceptInvitation_accepts_a_pending_unexpired_invitation_and_creates_the_new_membership_row() {
        val invitationStore = InMemoryInvitationStore()
        val membershipStore = InMemoryMembershipStore()
        sentInvitation(invitationStore)

        val result = acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1")

        check(result is AcceptInvitationResult.Accepted)
        assertEquals("ACTIVE", result.row.status.name)
        assertEquals("user-99", result.row.userId)
        assertEquals("org-1", result.row.organizationId)
        assertEquals(listOf("UMPIRE"), result.row.roles)
        assertEquals("2026-10-03T00:00:00Z", result.row.invitedAt)
        assertEquals("2026-10-05T00:00:00Z", result.row.acceptedAt)
    }

    @Test fun acceptInvitation_marks_the_invitation_ACCEPTED_after_a_successful_accept() {
        val invitationStore = InMemoryInvitationStore()
        val membershipStore = InMemoryMembershipStore()
        sentInvitation(invitationStore)

        acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1")

        val invitation = invitationStore.get("inv-1")
        assertEquals(InvitationStatus.ACCEPTED, invitation?.status)
        assertEquals("2026-10-05T00:00:00Z", invitation?.acceptedAt)
    }

    @Test fun acceptInvitation_404s_on_an_unknown_token() {
        val invitationStore = InMemoryInvitationStore()
        val membershipStore = InMemoryMembershipStore()
        val result = acceptInvitation("no-such-token", "user-99", invitationStore, membershipStore, "mem-1", "now", "req-1")
        check(result is AcceptInvitationResult.Rejected)
        assertEquals(404, result.problem.status)
    }

    @Test fun acceptInvitation_410s_on_an_expired_invitation() {
        val invitationStore = InMemoryInvitationStore()
        val membershipStore = InMemoryMembershipStore()
        sentInvitation(invitationStore, expiresAt = "2026-10-01T00:00:00Z")

        val result = acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1")
        check(result is AcceptInvitationResult.Rejected)
        assertEquals(410, result.problem.status)
    }

    @Test fun acceptInvitation_409s_when_re_accepting_an_already_ACCEPTED_invitation() {
        val invitationStore = InMemoryInvitationStore()
        val membershipStore = InMemoryMembershipStore()
        sentInvitation(invitationStore)
        acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1")

        val result = acceptInvitation("token-1", "user-100", invitationStore, membershipStore, "mem-2", "later", "req-2")
        check(result is AcceptInvitationResult.Rejected)
        assertEquals(409, result.problem.status)
    }

    @Test fun acceptInvitation_does_not_create_a_second_membership_row_on_a_rejected_re_accept() {
        val invitationStore = InMemoryInvitationStore()
        val membershipStore = InMemoryMembershipStore()
        sentInvitation(invitationStore)
        acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1")

        acceptInvitation("token-1", "user-100", invitationStore, membershipStore, "mem-2", "later", "req-2")

        assertTrue(membershipStore.get("mem-2") == null)
        assertTrue(membershipStore.get("mem-1") != null)
    }
}
