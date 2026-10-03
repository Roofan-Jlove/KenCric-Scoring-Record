package com.kencric.scoring.api.notificationpreferences

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0135`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/notificationPreferences.test.ts` (`TASK-0130`)
 * input-for-input.
 */
class NotificationPreferencesTest {

    @Test fun setNotificationPreference_sets_a_new_preference() {
        val store = InMemoryNotificationPreferenceStore()
        val result = setNotificationPreference("user-1", "PUSH", "WICKET", false, store, "2026-10-04T00:00:00Z", "req-1")

        check(result is SetNotificationPreferenceResult.Set)
        assertEquals(false, result.row.enabled)
        assertEquals("PUSH", result.row.channel)
        assertEquals("WICKET", result.row.eventType)
    }

    @Test fun setNotificationPreference_upserts_a_repeat_call_replaces_the_row_not_a_second_one() {
        val store = InMemoryNotificationPreferenceStore()
        setNotificationPreference("user-1", "PUSH", "WICKET", false, store, "now", "req-1")
        setNotificationPreference("user-1", "PUSH", "WICKET", true, store, "later", "req-2")

        val all = listNotificationPreferences("user-1", store)
        assertEquals(1, all.size)
        assertEquals(true, all[0].enabled)
        assertEquals("later", all[0].updatedAt)
    }

    @Test fun setNotificationPreference_missing_userId_is_schema_failure_400() {
        val store = InMemoryNotificationPreferenceStore()
        val result = setNotificationPreference("", "PUSH", "WICKET", true, store, "now", "req-1")
        check(result is SetNotificationPreferenceResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setNotificationPreference_missing_channel_is_schema_failure_400() {
        val store = InMemoryNotificationPreferenceStore()
        val result = setNotificationPreference("user-1", "", "WICKET", true, store, "now", "req-1")
        check(result is SetNotificationPreferenceResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setNotificationPreference_missing_eventType_is_schema_failure_400() {
        val store = InMemoryNotificationPreferenceStore()
        val result = setNotificationPreference("user-1", "PUSH", "", true, store, "now", "req-1")
        check(result is SetNotificationPreferenceResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setNotificationPreference_missing_enabled_is_schema_failure_400() {
        val store = InMemoryNotificationPreferenceStore()
        val result = setNotificationPreference("user-1", "PUSH", "WICKET", null, store, "now", "req-1")
        check(result is SetNotificationPreferenceResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setNotificationPreference_accepts_any_non_empty_channel_eventType_string() {
        val store = InMemoryNotificationPreferenceStore()
        val result = setNotificationPreference("user-1", "CARRIER_PIGEON", "SOMETHING_NOVEL", true, store, "now", "req-1")
        check(result is SetNotificationPreferenceResult.Set)
    }

    @Test fun listNotificationPreferences_returns_every_preference_row_for_the_given_user() {
        val store = InMemoryNotificationPreferenceStore()
        setNotificationPreference("user-1", "PUSH", "WICKET", false, store, "now", "req-1")
        setNotificationPreference("user-1", "PUSH", "RESULT", true, store, "now", "req-2")

        assertEquals(2, listNotificationPreferences("user-1", store).size)
    }

    @Test fun listNotificationPreferences_never_returns_another_users_preference_rows() {
        val store = InMemoryNotificationPreferenceStore()
        setNotificationPreference("user-1", "PUSH", "WICKET", false, store, "now", "req-1")
        setNotificationPreference("user-2", "PUSH", "WICKET", true, store, "now", "req-2")

        val user1Prefs = listNotificationPreferences("user-1", store)
        assertEquals(1, user1Prefs.size)
        assertEquals("user-1", user1Prefs[0].userId)
    }

    @Test fun listNotificationPreferences_returns_an_empty_array_for_a_user_with_no_preferences_set() {
        val store = InMemoryNotificationPreferenceStore()
        assertEquals(emptyList(), listNotificationPreferences("user-1", store))
    }
}
