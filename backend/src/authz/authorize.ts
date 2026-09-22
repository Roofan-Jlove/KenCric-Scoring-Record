/**
 * TASK-0014: SVC-AUTHORIZER server-side module skeleton
 * (domain-model.md §12, security-specification.md §4.1).
 *
 * Command-level authorization, called by every command handler
 * (backend/src/commands/) BEFORE any database write -- the middle layer
 * of the three-layer enforcement model (client-advisory -> SVC-AUTHORIZER
 * -> RLS, master-specification.md §5.4). RLS (TASK-0002/0004) remains the
 * hard boundary underneath this; this module is defense in depth, not a
 * replacement for it (SR-B01).
 *
 * The client-facing `detail` message is deliberately generic -- it does
 * NOT enumerate which specific role was missing or confirm/deny an
 * organization's existence to the caller, matching this corpus's
 * established anti-enumeration principle (adversarial-verification-report.md
 * §4: "identical failure responses... no authz-oracle leak found
 * anywhere checked"). A richer diagnostic detail belongs in server-side
 * logging/audit_log, not the HTTP response body -- not wired up by this
 * task, a natural extension point for whichever command handler task
 * needs it first.
 */

import type { RoleContext } from "./roleContext.js";
import { authForbidden, type ProblemDetails } from "./errors.js";

export interface AuthorizationCheck {
  roleContext: RoleContext;
  organizationId: string;
  /** Additive composition (SR-B03): any ONE of these roles is sufficient. */
  requiredRoles: readonly string[];
}

export type AuthorizationResult =
  | { authorized: true }
  | { authorized: false; problem: ProblemDetails };

/**
 * The check every command handler calls before any database write.
 * Pure function -- no I/O, fully unit-testable, since the RoleContext it
 * checks against was already resolved (fetchRoleContext, TASK-0013).
 */
export function authorize(
  check: AuthorizationCheck,
  instance: string,
): AuthorizationResult {
  const membership = check.roleContext.organizations[check.organizationId];

  if (!membership || !check.requiredRoles.some((role) => membership.roles.includes(role))) {
    return {
      authorized: false,
      problem: authForbidden(
        "You are not authorized to perform this action.",
        instance,
      ),
    };
  }

  return { authorized: true };
}
