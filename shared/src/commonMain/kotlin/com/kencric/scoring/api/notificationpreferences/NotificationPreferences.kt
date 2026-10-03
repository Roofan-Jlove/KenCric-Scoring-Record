package com.kencric.scoring.api.notificationpreferences

import com.kencric.scoring.api.errors.ApiProblem
import com.kencric.scoring.api.errors.schemaValidationError

/**
 * TASK-0135: a field-for-field Kotlin port of `backend/src/commands/
 * notificationPreferences.ts` (`TASK-0130`), the 19th Android backend-
 * command port. No new research -- see that module's own doc comment
 * for the full grounding (the deliberate storage-only scope boundary;
 * `channel`/`eventType` left as unconstrained strings, no canonical
 * list exists anywhere in this corpus to validate against).
 */

data class NotificationPreferenceRow(
    val userId: String,
    val channel: String,
    val eventType: String,
    val enabled: Boolean,
    val updatedAt: String,
)

interface NotificationPreferenceStore {
    fun get(userId: String, channel: String, eventType: String): NotificationPreferenceRow?
    fun upsert(row: NotificationPreferenceRow)
    /** Every preference row for one user -- backs `listNotificationPreferences`. */
    fun listByUser(userId: String): List<NotificationPreferenceRow>
}

sealed class SetNotificationPreferenceResult {
    data class Set(val row: NotificationPreferenceRow) : SetNotificationPreferenceResult()
    data class Rejected(val problem: ApiProblem) : SetNotificationPreferenceResult()
}

/** `PUT /users/me/notification-preferences/{channel}/{eventType}`. Idempotent upsert -- no `row_version`, the same shape `addSquadMember` already established. */
fun setNotificationPreference(
    userId: String,
    channel: String,
    eventType: String,
    enabled: Boolean?,
    store: NotificationPreferenceStore,
    nowIso: String,
    instance: String,
): SetNotificationPreferenceResult {
    if (userId.isEmpty()) {
        return SetNotificationPreferenceResult.Rejected(schemaValidationError("Missing required field: userId", instance))
    }
    if (channel.isEmpty()) {
        return SetNotificationPreferenceResult.Rejected(schemaValidationError("Missing required field: channel", instance))
    }
    if (eventType.isEmpty()) {
        return SetNotificationPreferenceResult.Rejected(schemaValidationError("Missing required field: eventType", instance))
    }
    if (enabled == null) {
        return SetNotificationPreferenceResult.Rejected(schemaValidationError("Missing required field: enabled", instance))
    }

    val row = NotificationPreferenceRow(userId = userId, channel = channel, eventType = eventType, enabled = enabled, updatedAt = nowIso)
    store.upsert(row)
    return SetNotificationPreferenceResult.Set(row)
}

/** `GET /users/me/notification-preferences`. No keyset pagination -- a user's own preference set is small by nature. */
fun listNotificationPreferences(userId: String, store: NotificationPreferenceStore): List<NotificationPreferenceRow> =
    store.listByUser(userId)

/** An in-memory NotificationPreferenceStore for tests -- not a production adapter. */
class InMemoryNotificationPreferenceStore : NotificationPreferenceStore {
    private val rows = mutableMapOf<String, NotificationPreferenceRow>()

    private fun key(userId: String, channel: String, eventType: String) = "$userId::$channel::$eventType"

    override fun get(userId: String, channel: String, eventType: String): NotificationPreferenceRow? = rows[key(userId, channel, eventType)]
    override fun upsert(row: NotificationPreferenceRow) { rows[key(row.userId, row.channel, row.eventType)] = row }
    override fun listByUser(userId: String): List<NotificationPreferenceRow> = rows.values.filter { it.userId == userId }
}
