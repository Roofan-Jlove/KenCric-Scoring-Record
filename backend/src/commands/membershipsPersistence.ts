/**
 * TASK-0155: the generic, cross-endpoint real Postgres row mapping for
 * `memberships`, moved out of `deactivateMemberPersistence.ts`
 * (`TASK-0153`, its original and only home) into its own module the
 * moment a SECOND real consumer (`invitationsPersistence.ts`, which
 * needs an INSERT-row mapping for a brand-new membership, a genuinely
 * different shape than `deactivateMember`'s own UPDATE-only mapping)
 * needed the shared read mapping -- the same "generalise on the second
 * real use" shape `idempotencyKeys.ts`/`auditLogPersistence.ts`/
 * `matchesPersistence.ts` already proved out.
 *
 * **Only the full-row read mapping (`mapMembershipRowFromDb`/
 * `hydrateMembership`) lives here -- write-row mapping stays local to
 * each consumer,** the same division `matchesPersistence.ts` already
 * established: `deactivateMember.ts`'s own update only ever touches
 * `status`; `invitations.ts`'s own `acceptInvitation` needs a full
 * INSERT of a brand-new row instead. Two genuinely different shapes
 * over the same table, not one shared shape forced together.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MembershipRow } from "./memberships.js";

export function mapMembershipRowFromDb(row: Record<string, unknown>): MembershipRow {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    organizationId: row.organization_id as string,
    roles: row.roles as string[],
    status: row.status as MembershipRow["status"],
    invitedAt: (row.invited_at as string) ?? null,
    acceptedAt: (row.accepted_at as string) ?? null,
    rowVersion: row.row_version as number,
    createdAt: row.created_at as string,
    createdBy: row.created_by as string,
    updatedAt: row.updated_at as string,
    updatedBy: row.updated_by as string,
  };
}

export async function hydrateMembership(client: SupabaseClient, membershipId: string): Promise<MembershipRow | null> {
  const { data, error } = await client.from("memberships").select("*").eq("id", membershipId).maybeSingle();
  if (error) throw new Error(`hydrateMembership: memberships query failed: ${error.message}`);
  return data ? mapMembershipRowFromDb(data as Record<string, unknown>) : null;
}
