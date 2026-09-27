package com.kencric.scoring.ui.screens.ux28administration

/**
 * TASK-0092: `ux-specification.md UX-28`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-28-administration/
 * administrationForm.ts` (`TASK-0091`) -- same contract-only scope note
 * as every earlier screen this session: no Android SDK/Gradle/Kotlin
 * toolchain exists, placed in `shared/commonMain` since this logic
 * touches no Android API surface at all.
 *
 * See `TASK-0091`'s own file for the full grounding (the P1/MVP-vs-V1
 * roadmap-bucket methodological finding; the SRS `FR-159`/`FR-160`
 * carve-outs; the `BR-032`/`FR-008`/`FR-009` citation gaps).
 */

enum class OrgRole { ORG_ADMIN, HEAD_SCORER, ASSISTANT_SCORER, CAPTAIN, VIEWER }

fun isOrgAdmin(roles: List<OrgRole>): Boolean = roles.contains(OrgRole.ORG_ADMIN)

enum class AdminSection { MEMBERS, FEATURE_FLAGS, REFERENCE_DATA, IMPERSONATION }

/** UX-28's own States text, verbatim: "Platform-only sections hidden entirely
 * for org-admins — not merely disabled — since visibility itself is role-driven." */
fun visibleAdminSections(isOrgAdminActor: Boolean, isPlatformAdmin: Boolean): List<AdminSection> {
    val sections = mutableListOf<AdminSection>()
    if (isOrgAdminActor) sections.add(AdminSection.MEMBERS)
    if (isPlatformAdmin) sections.addAll(listOf(AdminSection.FEATURE_FLAGS, AdminSection.REFERENCE_DATA, AdminSection.IMPERSONATION))
    return sections
}

/** SEC-005: the additive role model -- adding a role never removes another. */
fun addRole(currentRoles: List<OrgRole>, role: OrgRole): List<OrgRole> {
    if (currentRoles.contains(role)) return currentRoles.toList()
    return currentRoles + role
}

/** Revoking removes only the named role, leaving every other role intact --
 * the additive model's own inverse operation. */
fun removeRole(currentRoles: List<OrgRole>, role: OrgRole): List<OrgRole> =
    currentRoles.filter { it != role }

enum class AdminDestructiveAction { DEACTIVATE_MEMBER, REVOKE_ROLE }

sealed class ConfirmAdminActionResult {
    data object Confirmed : ConfirmAdminActionResult()
    data class Rejected(val reason: String) : ConfirmAdminActionResult()
}

/** UX-28's own States text: "Destructive-confirm (merge / deactivate / revoke)." */
fun confirmAdminDestructiveAction(action: AdminDestructiveAction, hasExplicitlyConfirmed: Boolean): ConfirmAdminActionResult {
    if (!hasExplicitlyConfirmed) {
        val label = if (action == AdminDestructiveAction.DEACTIVATE_MEMBER) "deactivate this member" else "revoke this role"
        return ConfirmAdminActionResult.Rejected("You must explicitly confirm before we $label")
    }
    return ConfirmAdminActionResult.Confirmed
}

data class ImpersonationConsent(
    val userId: String,
    val expiresAt: String,
)

sealed class ImpersonationRequestResult {
    data object Started : ImpersonationRequestResult()
    data class Refused(val reason: String) : ImpersonationRequestResult()
}

/** `SEC-06`/`SEC-011`: impersonation requires a stored, UNEXPIRED consent record. */
fun requestImpersonation(consent: ImpersonationConsent?, now: String): ImpersonationRequestResult {
    if (consent == null) {
        return ImpersonationRequestResult.Refused("No stored consent exists for this user")
    }
    if (consent.expiresAt <= now) {
        return ImpersonationRequestResult.Refused("The stored consent has expired")
    }
    return ImpersonationRequestResult.Started
}

/** `SEC-07`: every impersonated action's audit entry names both identities. */
fun impersonationAuditActor(adminId: String, impersonatedUserId: String): String =
    "$adminId (impersonating $impersonatedUserId)"

private val VERSION_PATTERN = Regex("^v(\\d+)$")

/** `BR-032`/`UX-28`'s own Validation text, verbatim: reference-data publishing
 * "always creates a new version, never overwrites in place." */
fun nextReferenceDataVersion(existingVersionIds: List<String>): String {
    val numbers = existingVersionIds.mapNotNull { VERSION_PATTERN.matchEntire(it)?.groupValues?.get(1)?.toInt() }
    val highest = numbers.maxOrNull() ?: 0
    return "v${highest + 1}"
}

enum class AdminActionKind { READ, WRITE }

/** UX-28's own Offline-behavior text: read-heavy views work from cache;
 * role/permission changes, invites, and reference-data publishing are
 * network-required and disabled offline. */
fun isAdminActionAvailable(kind: AdminActionKind, isOffline: Boolean): Boolean =
    kind == AdminActionKind.READ || !isOffline
