/**
 * TASK-0149: the real Postgres I/O layer for the `signoff` Edge
 * Function (`database/supabase/functions/signoff/index.ts`) --
 * `repository-structure.md §9`'s own second named example, picked as
 * the natural continuation of `TASK-0148`'s architecture-faithful
 * pattern after "mint the next task and continue."
 *
 * **A real, blocking schema gap found and resolved as part of this same
 * task, not deferred:** `signOffMatch.ts`'s own `IdempotencyStore`
 * interface has only ever had an in-memory test double standing in for
 * it -- no `idempotency_keys` table existed anywhere in `data-
 * specification.md` to back it for real, despite `api-specification.md
 * §8.1`/`§8.2` fully specifying the mechanism in prose. Added `§9.4`
 * (`database/supabase/migrations/20260923000047_create_idempotency_keys.sql`)
 * and `backend/src/commands/idempotencyKeys.ts`, the same "resolve the
 * blocking gap within the same task, don't silently defer it" shape
 * `TASK-0125`'s own `divergences` migration already used.
 *
 * **The same pure-core/IO-shell split `TASK-0148` established, reused
 * directly:** `signOffMatch()` itself (`TASK-0105`) is NOT modified --
 * this module resolves everything it needs (the real idempotency check,
 * the actual `actorRole`/`previousVersion`/`currentServerEventOrdinal`)
 * via real async Supabase queries, calls the existing pure function with
 * throwaway in-memory `SignOffStore`/`IdempotencyStore` instances (since
 * this wrapper, not the pure function, now owns the real persistence
 * decisions), then persists the result for real -- but ONLY when
 * `result.outcome === "signed"`, mirroring `signOffMatch()`'s OWN
 * already-correct internal rule (it calls `recordSuccess` only on its
 * own success branch, never on rejection) rather than persisting
 * unconditionally, which would have mis-cached a genuine business
 * rejection as if it were a cacheable success.
 *
 * **A real, significant trust-boundary gap, made concrete for the first
 * time by actually wiring this up -- flagged prominently, not invented
 * a fix for:** `signOffMatch.ts`'s own doc comment already states
 * `SVC-RECONCILER`/`SVC-RESULT-DERIVER` don't exist in `backend/` and
 * that `checks`/`overrideReason` are "explicit caller-supplied inputs."
 * In a REAL deployed Edge Function, "caller-supplied" means **the
 * client's own request body** -- there is no server-side re-derivation
 * of the reconciliation check list at all. A malicious or buggy client
 * could claim any `ReconciliationCheck[]` it wants, including an
 * all-PASS list for a match that would genuinely fail reconciliation.
 * This was always true in principle (the pure function's own doc
 * comment said so); wiring the real endpoint is what makes it a live,
 * exploitable gap rather than a theoretical one. Building `SVC-RECONCILER`
 * server-side is a real, large, separate undertaking (porting
 * `shared/`'s own reconciliation Kotlin pipeline), explicitly out of
 * this task's own scope.
 *
 * **`actorRole`/`previousVersion`/`currentServerEventOrdinal` ARE
 * resolved server-side, never trusted from the client** -- these three
 * are the ones a client genuinely could corrupt the integrity guarantee
 * by supplying itself (claiming to be Head Scorer, claiming a stale
 * `previousVersion` to skip a real one, claiming to be caught up when
 * it isn't). `resolveActorRole` reuses the identical `officials`→
 * `match_officials` resolution chain `syncEventsPersistence.ts`
 * (`TASK-0148`) already established for the same reason.
 *
 * `NOT integration-tested` -- same disclaimer as `syncEventsPersistence.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getPriorSuccessFromDb, recordSuccessToDb } from "./idempotencyKeys.js";
import {
  InMemoryIdempotencyStore,
  InMemorySignOffStore,
  signOffMatch,
  type ReconciliationCheck,
  type Role,
  type SignOffMatchResult,
  type SignOffRow,
} from "./signOffMatch.js";

const ENDPOINT = "sign-off";

/**
 * Pure: a user can hold more than one `match_officials` role on the
 * same match (distinct rows, `§5.3`'s own composite PK) -- `HEAD_SCORER`
 * takes priority whenever present, since that is the only value
 * `signOffMatch()` itself ever treats specially. The exact non-
 * privileged value returned when `roles` is empty or holds none of the
 * three named ones is inconsequential -- `signOffMatch()` rejects any
 * non-`HEAD_SCORER` value identically -- `ASSISTANT_SCORER` is used as
 * that placeholder, not a claim that one actually exists.
 */
export function pickHighestPriorityRole(roles: ReadonlySet<string>): Role {
  if (roles.has("HEAD_SCORER")) return "HEAD_SCORER";
  if (roles.has("ASSISTANT_SCORER")) return "ASSISTANT_SCORER";
  if (roles.has("UMPIRE")) return "UMPIRE";
  return "ASSISTANT_SCORER";
}

/** IO: resolves the requester's real role on this match from `officials`/`match_officials` -- never trusted from the client. */
export async function resolveActorRole(client: SupabaseClient, userId: string, matchId: string): Promise<Role> {
  const { data: officialRows, error: officialsError } = await client.from("officials").select("id").eq("user_id", userId);
  if (officialsError) throw new Error(`resolveActorRole: officials query failed: ${officialsError.message}`);

  const officialIds = (officialRows ?? []).map((row) => (row as Record<string, unknown>).id as string);
  if (officialIds.length === 0) return pickHighestPriorityRole(new Set());

  const { data: moRows, error: moError } = await client.from("match_officials").select("role").eq("match_id", matchId).in("official_id", officialIds);
  if (moError) throw new Error(`resolveActorRole: match_officials query failed: ${moError.message}`);

  const roles = new Set((moRows ?? []).map((row) => (row as Record<string, unknown>).role as string));
  return pickHighestPriorityRole(roles);
}

/** The highest `version` already recorded for this match, or `0` if none exist yet (`signOffMatch()`'s own `previousVersion > 0 ? previousVersion : null` convention for `supersedesVersion`). */
export async function resolvePreviousVersion(client: SupabaseClient, matchId: string): Promise<number> {
  const { data, error } = await client.from("sign_offs").select("version").eq("match_id", matchId).order("version", { ascending: false }).limit(1);
  if (error) throw new Error(`resolvePreviousVersion: sign_offs query failed: ${error.message}`);
  return data && data.length > 0 ? ((data[0] as Record<string, unknown>).version as number) : 0;
}

/** The server's own latest known `event_ordinal` for this match, or `0` if no events exist yet -- `§11.1`'s own staleness check compares the caller's `asOfEventOrdinal` against this. */
export async function resolveCurrentServerEventOrdinal(client: SupabaseClient, matchId: string): Promise<number> {
  const { data, error } = await client.from("match_events").select("event_ordinal").eq("match_id", matchId).order("event_ordinal", { ascending: false }).limit(1);
  if (error) throw new Error(`resolveCurrentServerEventOrdinal: match_events query failed: ${error.message}`);
  return data && data.length > 0 ? ((data[0] as Record<string, unknown>).event_ordinal as number) : 0;
}

export async function persistSignOff(client: SupabaseClient, row: SignOffRow): Promise<void> {
  const { error } = await client.from("sign_offs").insert({
    id: row.id,
    match_id: row.matchId,
    version: row.version,
    signed_by: row.signedBy,
    reconciliation_state: row.reconciliationState,
    override_reason: row.overrideReason,
    signed_at: row.signedAt,
    supersedes_version: row.supersedesVersion,
  });
  if (error) throw new Error(`persistSignOff: sign_offs insert failed: ${error.message}`);
}

export interface SignOffMatchRealInput {
  matchId: string;
  userId: string;
  checks: readonly ReconciliationCheck[];
  overrideReason: string | null;
  asOfEventOrdinal: number;
  idempotencyKey: string;
  newSignOffId: string;
  nowIso: string;
  instance: string;
}

/**
 * The real, end-to-end `POST /matches/{matchId}/sign-off` composition:
 * check the real idempotency cache first; if no prior success,
 * server-resolve `actorRole`/`previousVersion`/`currentServerEventOrdinal`,
 * run the existing unchanged `signOffMatch()`, and persist the result
 * ONLY on a genuine success -- a rejection is never cached, matching
 * `§8.2` and `signOffMatch()`'s own already-correct internal rule.
 */
export async function signOffMatchReal(client: SupabaseClient, input: SignOffMatchRealInput): Promise<SignOffMatchResult> {
  const priorSuccess = await getPriorSuccessFromDb<SignOffMatchResult>(client, ENDPOINT, input.idempotencyKey);
  if (priorSuccess) return priorSuccess;

  const [actorRole, previousVersion, currentServerEventOrdinal] = await Promise.all([
    resolveActorRole(client, input.userId, input.matchId),
    resolvePreviousVersion(client, input.matchId),
    resolveCurrentServerEventOrdinal(client, input.matchId),
  ]);

  const result = signOffMatch(
    {
      matchId: input.matchId,
      actorRole,
      checks: input.checks,
      overrideReason: input.overrideReason,
      asOfEventOrdinal: input.asOfEventOrdinal,
      currentServerEventOrdinal,
      previousVersion,
      signedBy: input.userId,
    },
    new InMemorySignOffStore(),
    new InMemoryIdempotencyStore(),
    input.idempotencyKey,
    input.newSignOffId,
    input.nowIso,
    input.instance,
  );

  if (result.outcome === "signed") {
    await persistSignOff(client, result.row);
    await recordSuccessToDb(client, ENDPOINT, input.idempotencyKey, result);
  }

  return result;
}
