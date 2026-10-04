/**
 * TASK-0152: the real Postgres I/O layer for the `organization-suspend`/
 * `organization-reactivate`/`organization-delete` Edge Functions,
 * continuing `TASK-0148`-`0151`'s architecture-faithful pattern after
 * "mint the next task and continue." Picked specifically because
 * `organizationLifecycle.ts` (`TASK-0133`) already has real `audit_log`
 * composition wired in (`TASK-0146`), the same reason `disputeMatch.ts`
 * was picked for `TASK-0151` -- and unlike `mergePlayers.ts`, it needs
 * no un-buildable missing service (`PlayerAppearanceLookup` has no real
 * backing anywhere in this backlog; `organizationLifecycle.ts` needs
 * only `organizations` itself).
 *
 * **A real authorization-plumbing finding, the same SHAPE as `TASK-0151`'s
 * `disputes` finding but a DIFFERENT proximate cause -- found by
 * checking the grant pattern BEFORE assuming, the direct lesson from
 * last task:** `organizations`' own `organizations_update` RLS policy
 * (`20260923000004_create_rls_policies.sql`) grants UPDATE to ANY
 * `ACTIVE` member, not just an org-admin -- its own comment says so
 * explicitly: "intentionally coarse... deferred to SVC-AUTHORIZER."
 * Unlike `disputes` (which has NO write path at all, so the write
 * simply fails), `organizations` WOULD succeed for literally any
 * active member under a single user-scoped client -- a different,
 * arguably more dangerous failure mode (a silent over-grant, not a
 * loud rejection) for an action as consequential as suspending or
 * deleting an entire organization. `organizationLifecycle.ts` itself
 * has no documented Authz line at all (no `api-specification.md`
 * endpoint was ever written for this pair, per `TASK-0133`'s own doc
 * comment) -- but `domain-model.md`'s own `ENT-ORGANIZATION` Lifecycle
 * and ordinary judgment both say this needs to be admin-gated, so the
 * same two-client pattern `TASK-0151` established is applied here too,
 * for the identical underlying reason (RLS alone cannot be trusted to
 * enforce the real authorization rule for this write).
 *
 * **The fix, identical shape to `TASK-0151`:** a user-scoped client
 * resolves a new `isOrganizationAdmin` check (a direct `memberships`
 * query for `ORGANIZATION_ADMIN` in `roles`, `status = 'ACTIVE'`, no
 * `matches` join needed this time since the target IS the organization
 * directly) before any write is attempted; a service-role client
 * performs every actual read/write once that check passes, bypassing
 * `organizations_update`'s own over-permissive policy entirely rather
 * than relying on it.
 *
 * **`auditLogPersistence.ts` (`TASK-0152`, this task) is the SECOND
 * real consumer of the audit-log adapter `TASK-0151` originally built
 * inline in `disputeMatchPersistence.ts`** -- moved to its own module
 * the moment this second consumer needed it, the same "generalise on
 * the second real use" shape `idempotencyKeys.ts` already proved out.
 *
 * Same pure-core/IO-shell split as every prior task:
 * `suspendOrganization()`/`reactivateOrganization()`/`deleteOrganization()`
 * are unmodified.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { InMemoryOrganizationStore, type OrganizationRow } from "./organizations.js";
import {
  deleteOrganization,
  reactivateOrganization,
  suspendOrganization,
  type DeleteOrganizationResult,
  type ReactivateOrganizationResult,
  type SuspendOrganizationResult,
} from "./organizationLifecycle.js";
import { authForbidden } from "../authz/errors.js";
import type { AuditLogWrite } from "./auditLog.js";
import { hydrateAuditLogStore, persistNewAuditLogRows } from "./auditLogPersistence.js";

/**
 * Direct `memberships` check for `ORGANIZATION_ADMIN` -- no `matches`
 * join needed here, unlike `disputeMatchPersistence.ts`'s own
 * `isOrganizationAdminForMatch`, since the target of this action is
 * the organization itself, not a match that merely belongs to one.
 */
export async function isOrganizationAdmin(userClient: SupabaseClient, userId: string, organizationId: string): Promise<boolean> {
  const { data, error } = await userClient
    .from("memberships")
    .select("roles")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "ACTIVE");
  if (error) throw new Error(`isOrganizationAdmin: memberships query failed: ${error.message}`);

  return (data ?? []).some((row) => ((row as Record<string, unknown>).roles as string[]).includes("ORGANIZATION_ADMIN"));
}

export function mapOrganizationRowFromDb(row: Record<string, unknown>): OrganizationRow {
  return {
    id: row.id as string,
    name: row.name as string,
    branding: row.branding,
    status: row.status as OrganizationRow["status"],
    rowVersion: row.row_version as number,
    createdAt: row.created_at as string,
    createdBy: row.created_by as string,
    updatedAt: row.updated_at as string,
    updatedBy: row.updated_by as string,
  };
}

export function mapOrganizationRowToUpdateRow(row: OrganizationRow): Record<string, unknown> {
  return { status: row.status, row_version: row.rowVersion, updated_at: row.updatedAt, updated_by: row.updatedBy };
}

async function hydrateOrganization(client: SupabaseClient, organizationId: string): Promise<OrganizationRow | null> {
  const { data, error } = await client.from("organizations").select("*").eq("id", organizationId).maybeSingle();
  if (error) throw new Error(`hydrateOrganization: organizations query failed: ${error.message}`);
  return data ? mapOrganizationRowFromDb(data as Record<string, unknown>) : null;
}

async function persistOrganizationUpdate(client: SupabaseClient, row: OrganizationRow): Promise<void> {
  const { error } = await client.from("organizations").update(mapOrganizationRowToUpdateRow(row)).eq("id", row.id);
  if (error) throw new Error(`persistOrganizationUpdate: organizations update failed: ${error.message}`);
}

export interface OrganizationLifecycleRealInput {
  organizationId: string;
  reason: string | undefined;
  newAuditLogId: string;
  actorRef: string;
  nowIso: string;
  instance: string;
}

async function hydrateOrgLifecycleDeps(serviceClient: SupabaseClient, input: OrganizationLifecycleRealInput) {
  const organization = await hydrateOrganization(serviceClient, input.organizationId);
  const store = new InMemoryOrganizationStore();
  if (organization) store.insert(organization);

  const auditLogStore = await hydrateAuditLogStore(serviceClient);
  const auditLog: AuditLogWrite = { store: auditLogStore, newId: input.newAuditLogId };

  return { store, auditLog, auditLogStore };
}

/** `POST /organizations/{orgId}/suspend`. */
export async function suspendOrganizationReal(userClient: SupabaseClient, serviceClient: SupabaseClient, input: OrganizationLifecycleRealInput): Promise<SuspendOrganizationResult> {
  if (!(await isOrganizationAdmin(userClient, input.actorRef, input.organizationId))) {
    return { outcome: "rejected", problem: authForbidden("Only an organization admin may suspend this organization.", input.instance) };
  }

  const { store, auditLog, auditLogStore } = await hydrateOrgLifecycleDeps(serviceClient, input);
  const result = suspendOrganization(input.organizationId, input.reason, input.actorRef, store, input.nowIso, input.instance, auditLog);

  if (result.outcome === "suspended") {
    await persistOrganizationUpdate(serviceClient, result.row);
    await persistNewAuditLogRows(serviceClient, auditLogStore);
  }

  return result;
}

/** `POST /organizations/{orgId}/reactivate`. */
export async function reactivateOrganizationReal(userClient: SupabaseClient, serviceClient: SupabaseClient, input: OrganizationLifecycleRealInput): Promise<ReactivateOrganizationResult> {
  if (!(await isOrganizationAdmin(userClient, input.actorRef, input.organizationId))) {
    return { outcome: "rejected", problem: authForbidden("Only an organization admin may reactivate this organization.", input.instance) };
  }

  const { store, auditLog, auditLogStore } = await hydrateOrgLifecycleDeps(serviceClient, input);
  const result = reactivateOrganization(input.organizationId, input.actorRef, store, input.nowIso, input.instance, auditLog);

  if (result.outcome === "reactivated") {
    await persistOrganizationUpdate(serviceClient, result.row);
    await persistNewAuditLogRows(serviceClient, auditLogStore);
  }

  return result;
}

/** `POST /organizations/{orgId}/delete`. */
export async function deleteOrganizationReal(userClient: SupabaseClient, serviceClient: SupabaseClient, input: OrganizationLifecycleRealInput): Promise<DeleteOrganizationResult> {
  if (!(await isOrganizationAdmin(userClient, input.actorRef, input.organizationId))) {
    return { outcome: "rejected", problem: authForbidden("Only an organization admin may delete this organization.", input.instance) };
  }

  const { store, auditLog, auditLogStore } = await hydrateOrgLifecycleDeps(serviceClient, input);
  const result = deleteOrganization(input.organizationId, input.reason, input.actorRef, store, input.nowIso, input.instance, auditLog);

  if (result.outcome === "deleted") {
    await persistOrganizationUpdate(serviceClient, result.row);
    await persistNewAuditLogRows(serviceClient, auditLogStore);
  }

  return result;
}
