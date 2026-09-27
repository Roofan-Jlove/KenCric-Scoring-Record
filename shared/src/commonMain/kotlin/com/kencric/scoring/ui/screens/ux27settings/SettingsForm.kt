package com.kencric.scoring.ui.screens.ux27settings

/**
 * TASK-0090: `ux-specification.md UX-27`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-27-settings/settingsForm.ts`
 * (`TASK-0089`) -- same contract-only scope note as every earlier screen
 * this session: no Android SDK/Gradle/Kotlin toolchain exists, placed in
 * `shared/commonMain` since this logic touches no Android API surface.
 *
 * See `TASK-0089`'s own file for the full grounding (the direction-
 * reversed same-number collision on `UX-27`'s own Trace line; the real
 * `FR-155` citation gap; `FR-157`/`FR-158` deferred as V1/V2 per `FA-8`).
 */

enum class SettingKind { LOCAL, ACCOUNT }

/** UX-27's own Offline behavior text: local/device preferences apply with no
 * network dependency; account-level (server-required) settings are disabled offline. */
fun isSettingEditable(kind: SettingKind, isOffline: Boolean): Boolean =
    kind == SettingKind.LOCAL || !isOffline

enum class DestructiveAction { DELETE_ACCOUNT, PURGE_STORAGE }

sealed class ConfirmDestructiveResult {
    data object Confirmed : ConfirmDestructiveResult()
    data class Rejected(val reason: String) : ConfirmDestructiveResult()
}

/** UX-27's own Validation text, verbatim: "Destructive actions (delete account,
 * purge storage) require an explicit confirm step." */
fun confirmDestructiveAction(action: DestructiveAction, hasExplicitlyConfirmed: Boolean): ConfirmDestructiveResult {
    if (!hasExplicitlyConfirmed) {
        val label = if (action == DestructiveAction.DELETE_ACCOUNT) "delete your account" else "purge local storage"
        return ConfirmDestructiveResult.Rejected("You must explicitly confirm before we $label")
    }
    return ConfirmDestructiveResult.Confirmed
}

data class PasswordChangeForm(
    val currentPassword: String,
    val newPassword: String,
    val confirmNewPassword: String,
)

sealed class PasswordChangeResult {
    data object Valid : PasswordChangeResult()
    data class Invalid(val reason: String) : PasswordChangeResult()
}

/** UX-27's own Validation text, verbatim: "a password change requires the current password." */
fun validatePasswordChange(form: PasswordChangeForm): PasswordChangeResult {
    if (form.currentPassword.trim().isEmpty()) {
        return PasswordChangeResult.Invalid("Current password is required")
    }
    if (form.newPassword.trim().isEmpty()) {
        return PasswordChangeResult.Invalid("New password is required")
    }
    if (form.newPassword != form.confirmNewPassword) {
        return PasswordChangeResult.Invalid("New password and confirmation do not match")
    }
    return PasswordChangeResult.Valid
}

/** OFR-016: "Warn the user before local storage limits are reached." The spec
 * gives no specific threshold -- 90% of the limit is this task's own explicit
 * assumption, not a cited number. */
private const val STORAGE_WARNING_THRESHOLD_RATIO = 0.9

fun shouldWarnStorageLimit(usedBytes: Long, totalBytes: Long): Boolean {
    if (totalBytes <= 0) return false
    return usedBytes.toDouble() / totalBytes.toDouble() >= STORAGE_WARNING_THRESHOLD_RATIO
}

data class PurgeCandidateMatch(
    val id: String,
    val date: String,
    val isSynced: Boolean,
)

/** FR-155's own acceptance criterion: "Given synced matches older than the
 * retention window, when purge is run, then their local copies are removed
 * and remain retrievable from the cloud." Un-synced matches are never eligible.
 * Pure UTC epoch-day arithmetic on "YYYY-MM-DD" strings -- avoids any
 * platform-timezone dependency, same reasoning as the web TS mirror. */
fun matchesEligibleForPurge(
    matches: List<PurgeCandidateMatch>,
    retentionDays: Int,
    today: String,
): List<String> {
    val cutoffEpochDay = isoDateToEpochDay(today) - retentionDays
    return matches.filter { it.isSynced && isoDateToEpochDay(it.date) < cutoffEpochDay }.map { it.id }
}

private fun isoDateToEpochDay(isoDate: String): Long {
    val (year, month, day) = isoDate.split("-").map { it.toInt() }
    // Days-from-civil algorithm (Howard Hinnant), proleptic Gregorian, epoch 1970-01-01.
    val y = if (month <= 2) year - 1 else year
    val era = (if (y >= 0) y else y - 399) / 400
    val yoe = y - era * 400
    val mp = (month + 9) % 12
    val doy = (153 * mp + 2) / 5 + day - 1
    val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
    return era * 146097L + doe - 719468L
}
