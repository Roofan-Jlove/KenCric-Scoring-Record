/**
 * TASK-0151: the real Postgres I/O layer for the `dispute-lock`/
 * `dispute-adjudicate` Edge Functions, continuing `TASK-0148`-`0150`'s
 * architecture-faithful pattern after "mint the next task and
 * continue." Picked once `system-architecture.md §3.9`'s own literally-
 * named command list (`/exports` already wired) was exhausted of
 * already-built, already-tested modules -- `/share-links` and
 * `/admin/impersonate` have no backend command module anywhere in this
 * backlog at all (confirmed by listing `backend/src/commands/`
 * directly), and `/competitions/recompute`/`/appearance-claims/approve`
 * are blocked on unbuilt epics. `§3.9`'s own list was illustrative
 * ("e.g. ...signoff, /exports, /share-links..."), not exhaustive --
 * `api-specification.md`'s own taxonomy puts EVERY `§11` match-lifecycle
 * command on the identical RPC/Edge-Function path, so continuing with
 * `disputeMatch.ts` (`§11.4`, already built and tested) stays within
 * the same architecture-faithful rule, just not one of `§3.9`'s own
 * named illustrative examples.
 *
 * **`disputeMatch.ts` was picked specifically because it already has
 * real `audit_log` composition wired in (`TASK-0146`)** -- this task
 * finally builds the real Postgres-backed `AuditLogStore` adapter that
 * composition has been calling into an in-memory store for, closing a
 * loop `TASK-0146` left open (it wired the WRITE call; no real adapter
 * backed it until now). That adapter (`HydratedAuditLogStore`/
 * `hydrateAuditLogStore`/`persistNewAuditLogRows`) was built here
 * first, then moved to its own `auditLogPersistence.ts` module
 * (`TASK-0152`) the moment a second real consumer needed it.
 *
 * **Same pure-core/IO-shell split as `TASK-0148`-`0150`:**
 * `lockMatchForDispute()`/`adjudicateDispute()` are unmodified. Both
 * need the FULL `matches` row (their own update spreads every existing
 * field, not just the ones they touch), not a partial projection --
 * `hydrateMatch` fetches and maps every column.
 *
 * **A real, pre-existing gap flagged, not silently fixed:** unlike
 * `signOffMatch`/`exportJobs`/`deactivateMember`/`claimMatch`,
 * `lockMatchForDispute`/`adjudicateDispute` were never given an
 * `Idempotency-Key` parameter at all (`TASK-0123`'s own original
 * design) -- `api-specification.md §8.1`'s own rule ("every command/
 * RPC endpoint with a side effect") would call for one. Retrofitting
 * the pure function's own signature is a real, bounded follow-up, out
 * of this task's scope (this task wraps what exists, it does not
 * redesign `TASK-0123`'s already-tested function signature). The lock
 * endpoint is already naturally conflict-safe in a weaker sense --
 * re-locking an already-`DISPUTED` match returns a clear `409`, not a
 * silent duplicate -- but a genuine network-retry of a SUCCESSFUL lock
 * would incorrectly 409 rather than replay the original `201`, the
 * concrete, user-visible symptom of this gap.
 *
 * **A real, blocking authorization-plumbing gap found and resolved
 * while wiring this for real, not discovered until the migration's own
 * comment was re-read directly:** `§11.4`'s own Authz line is "Org-
 * admin" -- but `disputeMatch.ts` defers all authorization to RLS
 * (`FA-7`, the default every module except `signOffMatch` uses), and
 * `disputes`' own migration (`TASK-0122`) deliberately grants NO
 * `INSERT`/`UPDATE` to `authenticated` at all ("locking/adjudicating a
 * dispute goes through TASK-0123's own command handler" -- its own
 * comment, written before any Edge Function existed to BE that
 * handler). RLS denies by default when a table has no matching policy,
 * regardless of any `GRANT` -- so a user-scoped client, as used by
 * every prior Edge Function in this backlog, cannot write to `disputes`
 * at all. The resolution: **two separate Supabase clients.** A
 * user-scoped one (forwarding the real `Authorization` header) is used
 * ONLY to resolve the caller's identity and to evaluate `isOrganization
 * AdminForMatch` -- re-deriving the exact same `matches`⟕`memberships`
 * join `disputes_select`'s own RLS policy (`TASK-0141`) already uses,
 * so this check enforces the identical rule RLS enforces for reads, now
 * at the application layer for a write RLS was never granted a policy
 * for. A service-role client (bypassing RLS entirely, `system-
 * architecture.md §3.8`'s own explicit sanction: "Edge Functions use
 * the service-role key server-side only") performs every actual read/
 * write once that check passes -- matching `audit_log`'s own identical
 * "command-handler-only, no direct authenticated grant" shape, just
 * made concrete for the first time by actually building the handler.
 *
 * **A real, separate bug found as a side effect of checking this,
 * fixed in the same task:** `export_jobs` (`TASK-0150`) was missing
 * its own `INSERT` grant+policy entirely -- a genuine omission, not a
 * deliberate service-role-only design like `disputes`' -- fixed by a
 * small follow-up migration (`20260923000049`), since `TASK-0150`'s
 * own migration is never retroactively edited.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { authForbidden } from "../authz/errors.js";
import { InMemoryMatchStore, type MatchRow } from "./matches.js";
import {
  adjudicateDispute,
  InMemoryDisputeStore,
  lockMatchForDispute,
  type AdjudicateDisputePayload,
  type AdjudicateDisputeResult,
  type DisputeRow,
  type LockMatchForDisputePayload,
  type LockMatchForDisputeResult,
} from "./disputeMatch.js";
import type { AuditLogWrite } from "./auditLog.js";
import { hydrateAuditLogStore, persistNewAuditLogRows } from "./auditLogPersistence.js";

/**
 * Re-derives `disputes_select`'s own RLS `exists(...)` check (`matches`
 * ⟕ `memberships`, `ORGANIZATION_ADMIN` role, `organization_id IS NOT
 * NULL`) at the application layer -- `disputes` itself has no write
 * policy for RLS to enforce this through, so this function IS the
 * enforcement of `§11.4`'s own "Org-admin" Authz line. Uses the
 * user-scoped client -- an org-less (guest) match has no org-admin
 * console to gate on in the first place, matching `disputes_select`'s
 * own boundary exactly.
 */
export async function isOrganizationAdminForMatch(userClient: SupabaseClient, userId: string, matchId: string): Promise<boolean> {
  const { data: matchRow, error: matchError } = await userClient.from("matches").select("organization_id").eq("id", matchId).maybeSingle();
  if (matchError) throw new Error(`isOrganizationAdminForMatch: matches query failed: ${matchError.message}`);

  const organizationId = matchRow ? ((matchRow as Record<string, unknown>).organization_id as string | null) : null;
  if (!organizationId) return false;

  const { data: membershipRows, error: membershipError } = await userClient
    .from("memberships")
    .select("roles")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "ACTIVE");
  if (membershipError) throw new Error(`isOrganizationAdminForMatch: memberships query failed: ${membershipError.message}`);

  return (membershipRows ?? []).some((row) => ((row as Record<string, unknown>).roles as string[]).includes("ORGANIZATION_ADMIN"));
}

// ---------------------------------------------------------------------------
// Pure row <-> type mapping.
// ---------------------------------------------------------------------------

export function mapMatchRowFromDb(row: Record<string, unknown>): MatchRow {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string) ?? null,
    originDeviceId: row.origin_device_id as string,
    claimStatus: row.claim_status as "GUEST" | "CLAIMED",
    homeTeamId: row.home_team_id as string,
    awayTeamId: row.away_team_id as string,
    homeXi: row.home_xi,
    awayXi: row.away_xi,
    format: row.format as MatchRow["format"],
    oversAllotted: (row.overs_allotted as number) ?? null,
    conditionsProfile: row.conditions_profile,
    conditionsProfileVersion: (row.conditions_profile_version as number) ?? null,
    dlsTableVersion: (row.dls_table_version as number) ?? null,
    rainMethod: row.rain_method as MatchRow["rainMethod"],
    tossWinnerTeamId: (row.toss_winner_team_id as string) ?? null,
    tossDecision: (row.toss_decision as string) ?? null,
    venue: (row.venue as string) ?? null,
    scheduledStart: (row.scheduled_start as string) ?? null,
    matchTimezone: row.match_timezone as string,
    minOversForResult: (row.min_overs_for_result as number) ?? null,
    state: row.state as MatchRow["state"],
    result: null,
    rowVersion: row.row_version as number,
    createdAt: row.created_at as string,
    createdBy: row.created_by as string,
    updatedAt: row.updated_at as string,
    updatedBy: row.updated_by as string,
  };
}

export function mapMatchRowToUpdateRow(row: MatchRow): Record<string, unknown> {
  return {
    state: row.state,
    row_version: row.rowVersion,
    updated_at: row.updatedAt,
    updated_by: row.updatedBy,
  };
}

export function mapDisputeRowFromDb(row: Record<string, unknown>): DisputeRow {
  return {
    id: row.id as string,
    matchId: row.match_id as string,
    status: row.status as DisputeRow["status"],
    reason: row.reason as string,
    lockedFromState: row.locked_from_state as DisputeRow["lockedFromState"],
    lockedBy: row.locked_by as string,
    lockedAt: row.locked_at as string,
    ruling: (row.ruling as string) ?? null,
    resultingCorrections: (row.resulting_corrections as string[]) ?? null,
    adjudicatedBy: (row.adjudicated_by as string) ?? null,
    adjudicatedAt: (row.adjudicated_at as string) ?? null,
    rowVersion: row.row_version as number,
  };
}

export function mapDisputeRowToInsertRow(row: DisputeRow): Record<string, unknown> {
  return {
    id: row.id,
    match_id: row.matchId,
    status: row.status,
    reason: row.reason,
    locked_from_state: row.lockedFromState,
    locked_by: row.lockedBy,
    locked_at: row.lockedAt,
    ruling: row.ruling,
    resulting_corrections: row.resultingCorrections,
    adjudicated_by: row.adjudicatedBy,
    adjudicated_at: row.adjudicatedAt,
    row_version: row.rowVersion,
  };
}

export function mapDisputeRowToUpdateRow(row: DisputeRow): Record<string, unknown> {
  return {
    status: row.status,
    ruling: row.ruling,
    resulting_corrections: row.resultingCorrections,
    adjudicated_by: row.adjudicatedBy,
    adjudicated_at: row.adjudicatedAt,
    row_version: row.rowVersion,
  };
}

async function hydrateMatch(client: SupabaseClient, matchId: string): Promise<MatchRow | null> {
  const { data, error } = await client.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (error) throw new Error(`hydrateMatch: matches query failed: ${error.message}`);
  return data ? mapMatchRowFromDb(data as Record<string, unknown>) : null;
}

async function persistMatchUpdate(client: SupabaseClient, row: MatchRow): Promise<void> {
  const { error } = await client.from("matches").update(mapMatchRowToUpdateRow(row)).eq("id", row.id);
  if (error) throw new Error(`persistMatchUpdate: matches update failed: ${error.message}`);
}

export interface LockMatchForDisputeRealInput {
  matchId: string;
  payload: LockMatchForDisputePayload;
  newDisputeId: string;
  newAuditLogId: string;
  actorRef: string;
  nowIso: string;
  instance: string;
}

/**
 * `POST /matches/{matchId}/dispute`. `userClient` (forwarding the real
 * `Authorization` header) resolves the "Org-admin" check; `serviceClient`
 * (bypassing RLS) performs every actual read/write once that check
 * passes -- see this module's own doc comment for the full reasoning.
 */
export async function lockMatchForDisputeReal(userClient: SupabaseClient, serviceClient: SupabaseClient, input: LockMatchForDisputeRealInput): Promise<LockMatchForDisputeResult> {
  if (!(await isOrganizationAdminForMatch(userClient, input.actorRef, input.matchId))) {
    return { outcome: "rejected", problem: authForbidden("Only an organization admin may lock this match for dispute.", input.instance) };
  }

  const match = await hydrateMatch(serviceClient, input.matchId);
  const matchStore = new InMemoryMatchStore();
  if (match) matchStore.insert(match);

  const { data: openRows, error: openError } = await serviceClient.from("disputes").select("*").eq("match_id", input.matchId).eq("status", "OPEN");
  if (openError) throw new Error(`lockMatchForDisputeReal: disputes query failed: ${openError.message}`);
  const disputeStore = new InMemoryDisputeStore();
  for (const row of openRows ?? []) disputeStore.insert(mapDisputeRowFromDb(row as Record<string, unknown>));

  const auditLogStore = await hydrateAuditLogStore(serviceClient);
  const auditLog: AuditLogWrite = { store: auditLogStore, newId: input.newAuditLogId };

  const result = lockMatchForDispute(input.matchId, input.payload, matchStore, disputeStore, input.newDisputeId, input.actorRef, input.nowIso, input.instance, auditLog);

  if (result.outcome === "locked") {
    await serviceClient.from("disputes").insert(mapDisputeRowToInsertRow(result.row));
    const updatedMatch = matchStore.get(input.matchId);
    if (updatedMatch) await persistMatchUpdate(serviceClient, updatedMatch);
    await persistNewAuditLogRows(serviceClient, auditLogStore);
  }

  return result;
}

export interface AdjudicateDisputeRealInput {
  matchId: string;
  payload: AdjudicateDisputePayload;
  newAuditLogId: string;
  actorRef: string;
  nowIso: string;
  instance: string;
}

/** `POST /matches/{matchId}/dispute/adjudicate`. Same two-client shape as `lockMatchForDisputeReal`. */
export async function adjudicateDisputeReal(userClient: SupabaseClient, serviceClient: SupabaseClient, input: AdjudicateDisputeRealInput): Promise<AdjudicateDisputeResult> {
  if (!(await isOrganizationAdminForMatch(userClient, input.actorRef, input.matchId))) {
    return { outcome: "rejected", problem: authForbidden("Only an organization admin may adjudicate this dispute.", input.instance) };
  }

  const match = await hydrateMatch(serviceClient, input.matchId);
  const matchStore = new InMemoryMatchStore();
  if (match) matchStore.insert(match);

  const { data: openRows, error: openError } = await serviceClient.from("disputes").select("*").eq("match_id", input.matchId).eq("status", "OPEN");
  if (openError) throw new Error(`adjudicateDisputeReal: disputes query failed: ${openError.message}`);
  const disputeStore = new InMemoryDisputeStore();
  for (const row of openRows ?? []) disputeStore.insert(mapDisputeRowFromDb(row as Record<string, unknown>));

  const auditLogStore = await hydrateAuditLogStore(serviceClient);
  const auditLog: AuditLogWrite = { store: auditLogStore, newId: input.newAuditLogId };

  const result = adjudicateDispute(input.matchId, input.payload, matchStore, disputeStore, input.actorRef, input.nowIso, input.instance, auditLog);

  if (result.outcome === "adjudicated") {
    const { error } = await serviceClient.from("disputes").update(mapDisputeRowToUpdateRow(result.row)).eq("id", result.row.id);
    if (error) throw new Error(`adjudicateDisputeReal: disputes update failed: ${error.message}`);
    const updatedMatch = matchStore.get(input.matchId);
    if (updatedMatch) await persistMatchUpdate(serviceClient, updatedMatch);
    await persistNewAuditLogRows(serviceClient, auditLogStore);
  }

  return result;
}
