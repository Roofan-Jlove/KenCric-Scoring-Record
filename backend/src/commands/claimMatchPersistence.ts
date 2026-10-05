/**
 * TASK-0154: the real Postgres I/O layer for the `claim-match` Edge
 * Function, continuing `TASK-0148`-`0153`'s architecture-faithful
 * pattern after "mint the next task and continue." Picked as the next
 * remaining already-built, already-tested `§11` command (`claimMatch.ts`,
 * `TASK-0102`) -- `mergePlayers.ts` is explicitly skipped, per memory
 * from the prior session, since its own `PlayerAppearanceLookup` port
 * has no real backing anywhere in this backlog.
 *
 * **A genuinely different authorization shape from `TASK-0151`-`0153`
 * -- found by checking `§11.7`'s own Authz line directly, not assumed
 * to need the same two-client pattern by default:** "Authenticated
 * user; no prior role required (claiming *establishes* the role)."
 * `claimMatch()` itself needs no app-level permission check beyond "is
 * logged in," which `auth.getUser()` on a user-scoped client already
 * resolves -- unlike `disputes`/`organizations`/`memberships`, there is
 * no narrower rule to re-derive, so `isOrganizationAdmin`-style logic
 * is deliberately NOT added here; doing so would invent a restriction
 * `§11.7` explicitly does not impose.
 *
 * **A real, materially bigger finding surfaced to the user directly
 * before building anything, not silently worked around (see
 * `matchesPersistence.ts`'s own doc comment for the full writeup):**
 * `matches` has NO RLS enabled anywhere and no explicit `GRANT`
 * statement anywhere in this schema's 48 migration files -- a much
 * larger gap than the three narrower authz-plumbing issues `TASK-0151`-
 * `0153` found and fixed (those tables all had RLS enabled with a
 * fixable policy gap; `matches` has no RLS boundary of any kind).
 * Presented via `AskUserQuestion`; the user chose to proceed with
 * wiring `claimMatch` now rather than pause to design a full `matches`
 * RLS policy set first. **The practical consequence for this module:**
 * since whether `authenticated` even has a working `UPDATE` grant on
 * `matches` is unconfirmed (no explicit grant, relying entirely on an
 * unverified Supabase platform default), the actual WRITE still uses
 * the service-role client for reliability -- NOT because `§11.7` needs
 * an app-level permission gate (it doesn't), but because the
 * user-scoped client's own write might silently fail or silently
 * succeed depending on an unconfirmed grant state neither this task
 * nor any prior one can verify. Identity resolution (`auth.getUser()`)
 * is the ONLY thing the user-scoped client is used for here.
 *
 * Same pure-core/IO-shell split as every prior task: `claimMatch()`
 * itself is unmodified, called with a throwaway, always-empty
 * `InMemoryIdempotencyStore` (the real idempotency decision already
 * happened via `idempotencyKeys.ts` before this function is ever
 * called), the same shape `signOffMatchPersistence.ts`/
 * `exportJobsPersistence.ts`/`deactivateMemberPersistence.ts` already
 * established.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { claimMatch, InMemoryIdempotencyStore, type ClaimMatchPayload, type ClaimMatchResult } from "./claimMatch.js";
import { InMemoryMatchStore, type MatchRow } from "./matches.js";
import { hydrateMatch } from "./matchesPersistence.js";
import { getPriorSuccessFromDb, recordSuccessToDb } from "./idempotencyKeys.js";

const ENDPOINT = "claim-match";

export function mapClaimMatchUpdateRow(row: MatchRow): Record<string, unknown> {
  return { claim_status: row.claimStatus, organization_id: row.organizationId, row_version: row.rowVersion, updated_at: row.updatedAt, updated_by: row.updatedBy };
}

async function persistClaimMatchUpdate(client: SupabaseClient, row: MatchRow): Promise<void> {
  const { error } = await client.from("matches").update(mapClaimMatchUpdateRow(row)).eq("id", row.id);
  if (error) throw new Error(`persistClaimMatchUpdate: matches update failed: ${error.message}`);
}

export interface ClaimMatchRealInput {
  matchId: string;
  payload: ClaimMatchPayload;
  idempotencyKey: string;
  actorRef: string;
  nowIso: string;
  instance: string;
}

/** `POST /matches/{matchId}/claim`. */
export async function claimMatchReal(serviceClient: SupabaseClient, input: ClaimMatchRealInput): Promise<ClaimMatchResult> {
  const priorSuccess = await getPriorSuccessFromDb<ClaimMatchResult>(serviceClient, ENDPOINT, input.idempotencyKey);
  if (priorSuccess) return priorSuccess;

  const match = await hydrateMatch(serviceClient, input.matchId);
  const store = new InMemoryMatchStore();
  if (match) store.insert(match);

  const result = claimMatch(input.matchId, input.payload, store, new InMemoryIdempotencyStore(), input.actorRef, input.nowIso, input.idempotencyKey, input.instance);

  if (result.outcome === "claimed") {
    await persistClaimMatchUpdate(serviceClient, result.row);
    await recordSuccessToDb(serviceClient, ENDPOINT, input.idempotencyKey, result);
  }

  return result;
}
