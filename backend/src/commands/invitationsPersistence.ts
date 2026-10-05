/**
 * TASK-0155: the real Postgres I/O layer for the `invite-member`/
 * `accept-invitation` Edge Functions, continuing `TASK-0148`-`0154`'s
 * architecture-faithful pattern after "mint the next task and
 * continue." Picked as the next remaining already-built, already-
 * tested `§11` command per memory's own tracked list.
 *
 * **A real, FOURTH instance of the "check the grant pattern first"
 * finding, same proximate cause as `disputes`/`memberships`:**
 * `invitations`' own migration (`TASK-0119`) grants NO `INSERT`/
 * `UPDATE` to `authenticated` at all -- "sending/accepting an
 * invitation goes through TASK-0120's own command handler... left as
 * default-deny." `inviteMember()`'s own Authz ("org-admin") reuses
 * `isOrganizationAdmin` directly, the identical fix `TASK-0151`-`0154`
 * already established.
 *
 * **A real, previously-unenforced authorization gap found and closed
 * while wiring `acceptInvitation` for real, not present in the pure
 * function at ALL:** `§11.5`'s own Authz line for accept is
 * "authenticated as the invited email" -- but `acceptInvitation()`'s
 * own doc comment (`TASK-0120`) states plainly that `acceptingUserId`
 * is "taken as an explicit caller-supplied input," with ZERO
 * verification anywhere that the caller's own email actually matches
 * `invitation.email`. Built here for the first time: a pure
 * `emailMatchesInvitation` check (case-insensitive -- an invited
 * address and a signed-up address differing only in case is a real,
 * plausible mismatch, not a security feature to rely on) compares the
 * authenticated user's own email (already resolved by the entrypoint's
 * `auth.getUser()` call, no extra query needed) against the hydrated
 * invitation's `email` column. A mismatch is rejected `403` BEFORE the
 * pure function is ever called -- without this check, ANY authenticated
 * user who merely obtained a token (e.g. a forwarded email) could
 * accept an invitation meant for someone else.
 *
 * Same pure-core/IO-shell split as every prior task: `inviteMember()`/
 * `acceptInvitation()` are both unmodified. Neither uses the
 * Idempotency-Key mechanism (`invitations.ts`'s own doc comment: a
 * deliberate departure, not an oversight -- `send` has no stated
 * idempotency contract, `accept`'s own natural key is the token
 * itself, already enforced by the `PENDING`-status check).
 * `acceptInvitation`'s own `membershipStore` is passed in EMPTY,
 * deliberately not seeded via `membershipsPersistence.ts`'s
 * `hydrateMembership` -- `acceptInvitation()`'s own logic never calls
 * `membershipStore.get()` at all, only `.insert()`, so seeding it
 * would be a real query with no purpose.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { authForbidden } from "../authz/errors.js";
import {
  acceptInvitation,
  inviteMember,
  InMemoryInvitationStore,
  type AcceptInvitationResult,
  type InvitationRow,
  type InviteMemberPayload,
  type InviteMemberResult,
} from "./invitations.js";
import { InMemoryMembershipStore, type MembershipRow } from "./memberships.js";
import { isOrganizationAdmin } from "./organizationLifecyclePersistence.js";

export function mapInvitationRowFromDb(row: Record<string, unknown>): InvitationRow {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    email: row.email as string,
    roles: row.roles as string[],
    token: row.token as string,
    status: row.status as InvitationRow["status"],
    expiresAt: row.expires_at as string,
    invitedAt: row.invited_at as string,
    invitedBy: row.invited_by as string,
    acceptedAt: (row.accepted_at as string) ?? null,
  };
}

export function mapInvitationRowToInsertRow(row: InvitationRow): Record<string, unknown> {
  return {
    id: row.id,
    organization_id: row.organizationId,
    email: row.email,
    roles: row.roles,
    token: row.token,
    status: row.status,
    expires_at: row.expiresAt,
    invited_at: row.invitedAt,
    invited_by: row.invitedBy,
    accepted_at: row.acceptedAt,
  };
}

export function mapInvitationRowToUpdateRow(row: InvitationRow): Record<string, unknown> {
  return { status: row.status, accepted_at: row.acceptedAt };
}

export function mapMembershipRowToInsertRow(row: MembershipRow): Record<string, unknown> {
  return {
    id: row.id,
    user_id: row.userId,
    organization_id: row.organizationId,
    roles: row.roles,
    status: row.status,
    invited_at: row.invitedAt,
    accepted_at: row.acceptedAt,
    row_version: row.rowVersion,
    created_at: row.createdAt,
    created_by: row.createdBy,
    updated_at: row.updatedAt,
    updated_by: row.updatedBy,
  };
}

/**
 * Pure: `§11.5`'s own Authz line for accept, case-insensitive since an
 * invited address and a signed-up address differing only in case is a
 * real, plausible mismatch, not a security boundary to rely on.
 */
export function emailMatchesInvitation(userEmail: string | null | undefined, invitation: InvitationRow): boolean {
  if (!userEmail) return false;
  return userEmail.toLowerCase() === invitation.email.toLowerCase();
}

async function hydrateInvitationByToken(client: SupabaseClient, token: string): Promise<InvitationRow | null> {
  const { data, error } = await client.from("invitations").select("*").eq("token", token).maybeSingle();
  if (error) throw new Error(`hydrateInvitationByToken: invitations query failed: ${error.message}`);
  return data ? mapInvitationRowFromDb(data as Record<string, unknown>) : null;
}

export interface InviteMemberRealInput {
  payload: InviteMemberPayload;
  newInvitationId: string;
  newToken: string;
  actorRef: string;
  nowIso: string;
  instance: string;
}

/** `POST /organizations/{orgId}/invitations`. */
export async function inviteMemberReal(userClient: SupabaseClient, serviceClient: SupabaseClient, input: InviteMemberRealInput): Promise<InviteMemberResult> {
  if (!input.payload.organizationId || !(await isOrganizationAdmin(userClient, input.actorRef, input.payload.organizationId))) {
    return { outcome: "rejected", problem: authForbidden("Only an organization admin may send invitations for this organization.", input.instance) };
  }

  const result = inviteMember(input.payload, new InMemoryInvitationStore(), input.actorRef, input.newInvitationId, input.newToken, input.nowIso, input.instance);

  if (result.outcome === "sent") {
    const { error } = await serviceClient.from("invitations").insert(mapInvitationRowToInsertRow(result.row));
    if (error) throw new Error(`inviteMemberReal: invitations insert failed: ${error.message}`);
  }

  return result;
}

export interface AcceptInvitationRealInput {
  token: string;
  acceptingUserId: string;
  acceptingUserEmail: string | null | undefined;
  newMembershipId: string;
  nowIso: string;
  instance: string;
}

/** `POST /invitations/{token}/accept`. */
export async function acceptInvitationReal(serviceClient: SupabaseClient, input: AcceptInvitationRealInput): Promise<AcceptInvitationResult> {
  const invitation = await hydrateInvitationByToken(serviceClient, input.token);
  const invitationStore = new InMemoryInvitationStore();
  if (invitation) invitationStore.insert(invitation);

  if (invitation && !emailMatchesInvitation(input.acceptingUserEmail, invitation)) {
    return { outcome: "rejected", problem: authForbidden("This invitation was not sent to your account's email address.", input.instance) };
  }

  const membershipStore = new InMemoryMembershipStore();

  const result = acceptInvitation(input.token, input.acceptingUserId, invitationStore, membershipStore, input.newMembershipId, input.nowIso, input.instance);

  if (result.outcome === "accepted") {
    const { error: membershipError } = await serviceClient.from("memberships").insert(mapMembershipRowToInsertRow(result.row));
    if (membershipError) throw new Error(`acceptInvitationReal: memberships insert failed: ${membershipError.message}`);

    const updatedInvitation = invitationStore.getByToken(input.token);
    if (updatedInvitation) {
      const { error: invitationError } = await serviceClient.from("invitations").update(mapInvitationRowToUpdateRow(updatedInvitation)).eq("id", updatedInvitation.id);
      if (invitationError) throw new Error(`acceptInvitationReal: invitations update failed: ${invitationError.message}`);
    }
  }

  return result;
}
