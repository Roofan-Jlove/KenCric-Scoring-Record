package com.kencric.scoring.api.userlocalepreferences

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0136`, cross-platform parity (`C-7`): mirrors
 * `backend/tests/userLocalePreferences.test.ts` (`TASK-0131`)
 * input-for-input.
 */
class UserLocalePreferencesTest {

    @Test fun setUserLocale_sets_a_new_locale_preference() {
        val store = InMemoryUserLocalePreferenceStore()
        val result = setUserLocale("user-1", "fr", store, "2026-10-04T00:00:00Z", "req-1")

        check(result is SetUserLocaleResult.Set)
        assertEquals("fr", result.row.locale)
    }

    @Test fun setUserLocale_upserts_a_repeat_call_replaces_the_row_not_a_second_one() {
        val store = InMemoryUserLocalePreferenceStore()
        setUserLocale("user-1", "fr", store, "now", "req-1")
        setUserLocale("user-1", "es", store, "later", "req-2")

        val row = getUserLocale("user-1", store)
        assertEquals("es", row.locale)
        assertEquals("later", row.updatedAt)
    }

    @Test fun setUserLocale_missing_userId_is_schema_failure_400() {
        val store = InMemoryUserLocalePreferenceStore()
        val result = setUserLocale("", "fr", store, "now", "req-1")
        check(result is SetUserLocaleResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setUserLocale_missing_locale_is_schema_failure_400() {
        val store = InMemoryUserLocalePreferenceStore()
        val result = setUserLocale("user-1", null, store, "now", "req-1")
        check(result is SetUserLocaleResult.Rejected)
        assertEquals(400, result.problem.status)
    }

    @Test fun setUserLocale_accepts_any_non_empty_locale_string() {
        val store = InMemoryUserLocalePreferenceStore()
        val result = setUserLocale("user-1", "klingon", store, "now", "req-1")
        check(result is SetUserLocaleResult.Set)
    }

    @Test fun getUserLocale_returns_the_stored_preference_when_one_exists() {
        val store = InMemoryUserLocalePreferenceStore()
        setUserLocale("user-1", "fr", store, "now", "req-1")
        assertEquals("fr", getUserLocale("user-1", store).locale)
    }

    @Test fun getUserLocale_defaults_to_English_when_no_preference_has_ever_been_set() {
        val store = InMemoryUserLocalePreferenceStore()
        assertEquals(DEFAULT_LOCALE, getUserLocale("user-1", store).locale)
    }

    @Test fun getUserLocale_never_returns_another_users_preference() {
        val store = InMemoryUserLocalePreferenceStore()
        setUserLocale("user-1", "fr", store, "now", "req-1")
        setUserLocale("user-2", "es", store, "now", "req-2")

        assertEquals("fr", getUserLocale("user-1", store).locale)
        assertEquals("es", getUserLocale("user-2", store).locale)
    }
}
