package com.kencric.scoring.api.userlocalepreferences

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0136: a field-for-field Kotlin port of `backend/src/commands/
 * userLocalePreferences.ts` (`TASK-0131`), the 20th Android backend-
 * command port. No new research -- see that module's own doc comment
 * for the full grounding (the deliberate storage-only scope boundary;
 * why this is a separate table/module from `users` rather than a new
 * field there).
 */

const val DEFAULT_LOCALE = "en"

data class UserLocalePreferenceRow(
    val userId: String,
    val locale: String,
    val updatedAt: String,
)

interface UserLocalePreferenceStore {
    fun get(userId: String): UserLocalePreferenceRow?
    fun upsert(row: UserLocalePreferenceRow)
}

sealed class SetUserLocaleResult {
    data class Set(val row: UserLocalePreferenceRow) : SetUserLocaleResult()
    data class Rejected(val problem: ApiProblem) : SetUserLocaleResult()
}

/** `PUT /users/me/locale-preference`. Idempotent upsert -- no `row_version`. */
fun setUserLocale(userId: String, locale: String?, store: UserLocalePreferenceStore, nowIso: String, instance: String): SetUserLocaleResult {
    if (userId.isEmpty()) {
        return SetUserLocaleResult.Rejected(schemaValidationError("Missing required field: userId", instance))
    }
    if (locale.isNullOrEmpty()) {
        return SetUserLocaleResult.Rejected(schemaValidationError("Missing required field: locale", instance))
    }

    val row = UserLocalePreferenceRow(userId = userId, locale = locale, updatedAt = nowIso)
    store.upsert(row)
    return SetUserLocaleResult.Set(row)
}

/** `GET /users/me/locale-preference`. Never rejects -- an absent row defaults to `DEFAULT_LOCALE`. */
fun getUserLocale(userId: String, store: UserLocalePreferenceStore): UserLocalePreferenceRow =
    store.get(userId) ?: UserLocalePreferenceRow(userId = userId, locale = DEFAULT_LOCALE, updatedAt = "")

/** An in-memory UserLocalePreferenceStore for tests -- not a production adapter. */
class InMemoryUserLocalePreferenceStore : UserLocalePreferenceStore {
    private val rows = mutableMapOf<String, UserLocalePreferenceRow>()

    override fun get(userId: String): UserLocalePreferenceRow? = rows[userId]
    override fun upsert(row: UserLocalePreferenceRow) { rows[row.userId] = row }
}
