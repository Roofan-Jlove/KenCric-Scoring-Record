/**
 * TASK-0013 (deferred half): a signed-in request's role/org context is
 * derivable entirely from the JWT + memberships table, with no
 * client-supplied role claim trusted directly (SR-B01,
 * data-specification.md §3.3, security-specification.md §4).
 *
 * Split deliberately into a pure computation (computeRoleContext) and an
 * I/O fetch (fetchRoleContext). Only the pure half is unit-tested here --
 * fetchRoleContext needs a live Supabase project, which does not exist
 * anywhere in this session (release-readiness-assessment.md: still
 * NO-GO), so it is written but not integration-tested.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type MembershipStatus = "ACTIVE" | "DEACTIVATED";

export interface MembershipRow {
  organizationId: string;
  roles: string[];
  status: MembershipStatus;
}

export interface RoleContext {
  userId: string;
  /** Keyed by organizationId. Only ACTIVE memberships are included --
   * a DEACTIVATED member "performs no new actions" (data-specification.md
   * §3.3, BR-024), so their roles simply do not appear here. */
  organizations: Record<string, { roles: string[] }>;
}

/**
 * Pure: given a user id and their raw membership rows (as read from the
 * memberships table), compute the role context a command handler checks
 * against. No I/O -- fully unit-testable.
 */
export function computeRoleContext(
  userId: string,
  memberships: readonly MembershipRow[],
): RoleContext {
  const organizations: Record<string, { roles: string[] }> = {};
  for (const membership of memberships) {
    if (membership.status !== "ACTIVE") continue;
    organizations[membership.organizationId] = { roles: membership.roles };
  }
  return { userId, organizations };
}

/**
 * I/O: fetches this user's ACTIVE memberships from Postgres via the
 * Supabase client and computes their role context. The client must
 * already be scoped to the requesting user's session (never the service
 * role) -- RLS (TASK-0002) still applies underneath this query as a
 * second, independent enforcement layer.
 *
 * NOT integration-tested in this task: no Supabase project exists
 * anywhere in this repository yet to run this against.
 */
export async function fetchRoleContext(
  client: SupabaseClient,
  userId: string,
): Promise<RoleContext> {
  const { data, error } = await client
    .from("memberships")
    .select("organization_id, roles, status")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`fetchRoleContext: memberships query failed: ${error.message}`);
  }

  const memberships: MembershipRow[] = (data ?? []).map((row) => ({
    organizationId: row.organization_id as string,
    roles: row.roles as string[],
    status: row.status as MembershipStatus,
  }));

  return computeRoleContext(userId, memberships);
}
