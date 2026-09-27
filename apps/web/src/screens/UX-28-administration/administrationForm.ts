/**
 * TASK-0091: `ux-specification.md UX-28` -- Administration. MVP subset
 * only: org-admin member/role management (FR-007/008/009, SEC-005) plus
 * platform-admin feature-flags/reference-data/impersonation (FR-160's own
 * carve-out, BR-032, FR-161/SEC-011). Player-merge (FR-039, V2), dispute
 * lock/adjudication (FR-106, P2), competition/template config and
 * branding (the P2 remainder of FR-159), and platform tenant management
 * (the P2 remainder of FR-160) are NOT built here -- see the backlog's
 * own `§6.3` tracking entry.
 *
 * Role checks here are UI-level convenience only, per `ai-context-pack.md
 * FA-7` ("client-side permission checks are sufficient authorization" is
 * a false assumption) -- the real boundary is server-side RLS/SEC-005
 * enforcement, not this module.
 */

export type OrgRole = "ORG_ADMIN" | "HEAD_SCORER" | "ASSISTANT_SCORER" | "CAPTAIN" | "VIEWER";
export type PlatformRole = "PLATFORM_ADMIN";

export function isOrgAdmin(roles: readonly OrgRole[]): boolean {
  return roles.includes("ORG_ADMIN");
}

export type AdminSection = "MEMBERS" | "FEATURE_FLAGS" | "REFERENCE_DATA" | "IMPERSONATION";

/** UX-28's own States text, verbatim: "Platform-only sections hidden entirely
 * for org-admins — not merely disabled — since visibility itself is role-driven." */
export function visibleAdminSections(isOrgAdminActor: boolean, isPlatformAdmin: boolean): AdminSection[] {
  const sections: AdminSection[] = [];
  if (isOrgAdminActor) sections.push("MEMBERS");
  if (isPlatformAdmin) sections.push("FEATURE_FLAGS", "REFERENCE_DATA", "IMPERSONATION");
  return sections;
}

/** SEC-005: the additive role model -- adding a role never removes another. */
export function addRole(currentRoles: readonly OrgRole[], role: OrgRole): OrgRole[] {
  if (currentRoles.includes(role)) return [...currentRoles];
  return [...currentRoles, role];
}

/** Revoking removes only the named role, leaving every other role intact --
 * the additive model's own inverse operation. */
export function removeRole(currentRoles: readonly OrgRole[], role: OrgRole): OrgRole[] {
  return currentRoles.filter((r) => r !== role);
}

export type AdminDestructiveAction = "DEACTIVATE_MEMBER" | "REVOKE_ROLE";

export type ConfirmAdminActionResult =
  | { outcome: "confirmed" }
  | { outcome: "rejected"; reason: string };

/** UX-28's own States text: "Destructive-confirm (merge / deactivate / revoke)." */
export function confirmAdminDestructiveAction(
  action: AdminDestructiveAction,
  hasExplicitlyConfirmed: boolean,
): ConfirmAdminActionResult {
  if (!hasExplicitlyConfirmed) {
    const label = action === "DEACTIVATE_MEMBER" ? "deactivate this member" : "revoke this role";
    return { outcome: "rejected", reason: `You must explicitly confirm before we ${label}` };
  }
  return { outcome: "confirmed" };
}

export interface ImpersonationConsent {
  userId: string;
  expiresAt: string;
}

export type ImpersonationRequestResult =
  | { outcome: "started" }
  | { outcome: "refused"; reason: string };

/** `SEC-06`/`SEC-011`: impersonation requires a stored, UNEXPIRED consent record. */
export function requestImpersonation(consent: ImpersonationConsent | null, now: string): ImpersonationRequestResult {
  if (!consent) {
    return { outcome: "refused", reason: "No stored consent exists for this user" };
  }
  if (consent.expiresAt <= now) {
    return { outcome: "refused", reason: "The stored consent has expired" };
  }
  return { outcome: "started" };
}

/** `SEC-07`: every impersonated action's audit entry names both identities. */
export function impersonationAuditActor(adminId: string, impersonatedUserId: string): string {
  return `${adminId} (impersonating ${impersonatedUserId})`;
}

/** `BR-032`/`UX-28`'s own Validation text, verbatim: reference-data publishing
 * "always creates a new version, never overwrites in place." */
export function nextReferenceDataVersion(existingVersionIds: readonly string[]): string {
  const numbers = existingVersionIds
    .map((id) => /^v(\d+)$/.exec(id))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]));
  const highest = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `v${highest + 1}`;
}

export type AdminActionKind = "READ" | "WRITE";

/** UX-28's own Offline-behavior text: read-heavy views work from cache;
 * role/permission changes, invites, and reference-data publishing are
 * network-required and disabled offline. */
export function isAdminActionAvailable(kind: AdminActionKind, isOffline: boolean): boolean {
  return kind === "READ" || !isOffline;
}
