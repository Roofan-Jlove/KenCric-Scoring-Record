package com.kencric.scoring.ui.screens.ux27settings

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * `TASK-0090`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-27-settings/settingsForm.test.ts`
 * (`TASK-0089`) input-for-input.
 */
class SettingsFormTest {

    @Test fun isSettingEditable_local_is_always_editable() {
        assertTrue(isSettingEditable(SettingKind.LOCAL, isOffline = false))
        assertTrue(isSettingEditable(SettingKind.LOCAL, isOffline = true))
    }

    @Test fun isSettingEditable_account_disabled_only_while_offline() {
        assertTrue(isSettingEditable(SettingKind.ACCOUNT, isOffline = false))
        assertFalse(isSettingEditable(SettingKind.ACCOUNT, isOffline = true))
    }

    @Test fun confirmDestructiveAction_rejects_delete_account_without_confirmation() {
        val result = confirmDestructiveAction(DestructiveAction.DELETE_ACCOUNT, hasExplicitlyConfirmed = false)
        assertTrue(result is ConfirmDestructiveResult.Rejected)
    }

    @Test fun confirmDestructiveAction_rejects_purge_storage_without_confirmation() {
        val result = confirmDestructiveAction(DestructiveAction.PURGE_STORAGE, hasExplicitlyConfirmed = false)
        assertTrue(result is ConfirmDestructiveResult.Rejected)
    }

    @Test fun confirmDestructiveAction_confirms_once_explicitly_acknowledged() {
        assertEquals(ConfirmDestructiveResult.Confirmed, confirmDestructiveAction(DestructiveAction.DELETE_ACCOUNT, true))
        assertEquals(ConfirmDestructiveResult.Confirmed, confirmDestructiveAction(DestructiveAction.PURGE_STORAGE, true))
    }

    @Test fun validatePasswordChange_requires_current_password() {
        val result = validatePasswordChange(PasswordChangeForm("", "newpass1", "newpass1"))
        assertEquals(PasswordChangeResult.Invalid("Current password is required"), result)
    }

    @Test fun validatePasswordChange_requires_non_empty_new_password() {
        val result = validatePasswordChange(PasswordChangeForm("oldpass1", "", ""))
        assertTrue(result is PasswordChangeResult.Invalid)
    }

    @Test fun validatePasswordChange_requires_new_password_and_confirmation_to_match() {
        val result = validatePasswordChange(PasswordChangeForm("oldpass1", "newpass1", "newpass2"))
        assertEquals(PasswordChangeResult.Invalid("New password and confirmation do not match"), result)
    }

    @Test fun validatePasswordChange_valid_with_current_password_and_matching_pair() {
        val result = validatePasswordChange(PasswordChangeForm("oldpass1", "newpass1", "newpass1"))
        assertEquals(PasswordChangeResult.Valid, result)
    }

    @Test fun shouldWarnStorageLimit_false_well_under_threshold() {
        assertFalse(shouldWarnStorageLimit(100, 1000))
    }

    @Test fun shouldWarnStorageLimit_true_at_or_above_90_percent() {
        assertTrue(shouldWarnStorageLimit(900, 1000))
        assertTrue(shouldWarnStorageLimit(950, 1000))
    }

    @Test fun shouldWarnStorageLimit_false_with_no_configured_limit() {
        assertFalse(shouldWarnStorageLimit(500, 0))
    }

    private val purgeCandidates = listOf(
        PurgeCandidateMatch(id = "old-synced", date = "2025-01-01", isSynced = true),
        PurgeCandidateMatch(id = "old-unsynced", date = "2025-01-01", isSynced = false),
        PurgeCandidateMatch(id = "recent-synced", date = "2026-09-20", isSynced = true),
    )

    @Test fun matchesEligibleForPurge_selects_only_synced_matches_older_than_the_retention_window() {
        assertEquals(listOf("old-synced"), matchesEligibleForPurge(purgeCandidates, 30, "2026-09-28"))
    }

    @Test fun matchesEligibleForPurge_selects_nothing_when_no_match_is_old_enough() {
        assertEquals(emptyList(), matchesEligibleForPurge(purgeCandidates, 3650, "2026-09-28"))
    }
}
