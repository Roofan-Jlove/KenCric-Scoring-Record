package com.kencric.scoring.ui.screens.ux28administration

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * `TASK-0092`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-28-administration/administrationForm.test.ts`
 * (`TASK-0091`) input-for-input.
 */
class AdministrationFormTest {

    @Test fun isOrgAdmin_true_only_when_ORG_ADMIN_is_among_the_roles() {
        assertTrue(isOrgAdmin(listOf(OrgRole.ORG_ADMIN, OrgRole.HEAD_SCORER)))
        assertFalse(isOrgAdmin(listOf(OrgRole.HEAD_SCORER)))
    }

    @Test fun visibleAdminSections_org_admins_see_members_only() {
        assertEquals(listOf(AdminSection.MEMBERS), visibleAdminSections(isOrgAdminActor = true, isPlatformAdmin = false))
    }

    @Test fun visibleAdminSections_platform_admins_see_platform_sections_only() {
        assertEquals(
            listOf(AdminSection.FEATURE_FLAGS, AdminSection.REFERENCE_DATA, AdminSection.IMPERSONATION),
            visibleAdminSections(isOrgAdminActor = false, isPlatformAdmin = true),
        )
    }

    @Test fun visibleAdminSections_both_roles_sees_everything() {
        assertEquals(
            listOf(AdminSection.MEMBERS, AdminSection.FEATURE_FLAGS, AdminSection.REFERENCE_DATA, AdminSection.IMPERSONATION),
            visibleAdminSections(isOrgAdminActor = true, isPlatformAdmin = true),
        )
    }

    @Test fun visibleAdminSections_neither_role_sees_nothing() {
        assertEquals(emptyList(), visibleAdminSections(isOrgAdminActor = false, isPlatformAdmin = false))
    }

    @Test fun addRole_never_removes_an_existing_role() {
        assertEquals(listOf(OrgRole.HEAD_SCORER, OrgRole.CAPTAIN), addRole(listOf(OrgRole.HEAD_SCORER), OrgRole.CAPTAIN))
    }

    @Test fun addRole_does_not_duplicate_an_already_held_role() {
        assertEquals(listOf(OrgRole.HEAD_SCORER), addRole(listOf(OrgRole.HEAD_SCORER), OrgRole.HEAD_SCORER))
    }

    @Test fun removeRole_leaves_every_other_role_intact() {
        assertEquals(listOf(OrgRole.HEAD_SCORER), removeRole(listOf(OrgRole.HEAD_SCORER, OrgRole.CAPTAIN), OrgRole.CAPTAIN))
    }

    @Test fun confirmAdminDestructiveAction_rejects_deactivation_without_confirmation() {
        assertTrue(confirmAdminDestructiveAction(AdminDestructiveAction.DEACTIVATE_MEMBER, false) is ConfirmAdminActionResult.Rejected)
    }

    @Test fun confirmAdminDestructiveAction_rejects_role_revocation_without_confirmation() {
        assertTrue(confirmAdminDestructiveAction(AdminDestructiveAction.REVOKE_ROLE, false) is ConfirmAdminActionResult.Rejected)
    }

    @Test fun confirmAdminDestructiveAction_confirms_once_explicitly_acknowledged() {
        assertEquals(ConfirmAdminActionResult.Confirmed, confirmAdminDestructiveAction(AdminDestructiveAction.DEACTIVATE_MEMBER, true))
    }

    @Test fun requestImpersonation_refuses_with_no_stored_consent() {
        val result = requestImpersonation(null, "2026-09-28T00:00:00Z")
        assertEquals(ImpersonationRequestResult.Refused("No stored consent exists for this user"), result)
    }

    @Test fun requestImpersonation_refuses_with_an_expired_consent() {
        val consent = ImpersonationConsent(userId = "u1", expiresAt = "2026-09-01T00:00:00Z")
        val result = requestImpersonation(consent, "2026-09-28T00:00:00Z")
        assertEquals(ImpersonationRequestResult.Refused("The stored consent has expired"), result)
    }

    @Test fun requestImpersonation_starts_with_an_unexpired_consent() {
        val consent = ImpersonationConsent(userId = "u1", expiresAt = "2026-12-01T00:00:00Z")
        assertEquals(ImpersonationRequestResult.Started, requestImpersonation(consent, "2026-09-28T00:00:00Z"))
    }

    @Test fun impersonationAuditActor_names_both_identities() {
        assertEquals("admin-1 (impersonating user-42)", impersonationAuditActor("admin-1", "user-42"))
    }

    @Test fun nextReferenceDataVersion_starts_at_v1_with_no_existing_versions() {
        assertEquals("v1", nextReferenceDataVersion(emptyList()))
    }

    @Test fun nextReferenceDataVersion_increments_past_the_highest_existing_version() {
        assertEquals("v3", nextReferenceDataVersion(listOf("v1", "v2")))
    }

    @Test fun nextReferenceDataVersion_ignores_non_matching_ids() {
        assertEquals("v6", nextReferenceDataVersion(listOf("initial", "v5")))
    }

    @Test fun isAdminActionAvailable_read_actions_are_always_available() {
        assertTrue(isAdminActionAvailable(AdminActionKind.READ, isOffline = true))
    }

    @Test fun isAdminActionAvailable_write_actions_are_disabled_offline() {
        assertTrue(isAdminActionAvailable(AdminActionKind.WRITE, isOffline = false))
        assertFalse(isAdminActionAvailable(AdminActionKind.WRITE, isOffline = true))
    }
}
