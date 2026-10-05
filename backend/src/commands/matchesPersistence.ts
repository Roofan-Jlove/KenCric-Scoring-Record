/**
 * TASK-0154: the generic, cross-endpoint real Postgres row mapping for
 * `matches`, moved out of `disputeMatchPersistence.ts` (`TASK-0151`,
 * its original and only home) into its own module the moment a SECOND
 * real consumer (`claimMatchPersistence.ts`) needed it -- the same
 * "generalise on the second real use" shape `idempotencyKeys.ts`/
 * `auditLogPersistence.ts` already proved out.
 *
 * **Only the full-row read mapping (`mapMatchRowFromDb`/`hydrateMatch`)
 * lives here -- update-row mapping stays local to each consumer.**
 * `disputeMatch.ts`'s own update only ever touches `state`;
 * `claimMatch.ts`'s own update touches `claim_status`/`organization_id`
 * instead -- two genuinely different partial-update shapes over the
 * same table, not one shared shape artificially forced together.
 *
 * **A real, significant finding, surfaced to the user directly before
 * building `claimMatchPersistence.ts` (not silently worked around):**
 * unlike every other table this backlog has wired an Edge Function
 * against so far (`disputes`/`organizations`/`memberships`, each with
 * RLS enabled and at least a `SELECT` policy), `matches` has **no RLS
 * enabled anywhere, and no explicit `GRANT` statement anywhere** --
 * confirmed by searching all 48 migration files directly for any
 * `enable row level security`/`create policy`/`grant` statement naming
 * `public.matches`; none exists. This is a materially bigger gap than
 * the three authorization-plumbing findings `TASK-0151`-`0153` already
 * found and fixed -- those all had SOME RLS boundary with a narrower
 * policy gap; `matches` has none at all, meaning access today depends
 * entirely on whatever default grant Supabase's own platform bootstrap
 * applies, unconfirmed either way. **Not fixed here** -- designing a
 * real RLS policy set for the single most central table in this
 * schema (creator/org-member reads, scorer/org-admin writes, guest-
 * match rules) is a genuinely separate, much larger task than wiring
 * one Edge Function; the user was asked directly and chose to proceed
 * with wiring `claimMatch` now, flagging this gap prominently rather
 * than attempting to fix it as a side effect.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchRow } from "./matches.js";

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

export async function hydrateMatch(client: SupabaseClient, matchId: string): Promise<MatchRow | null> {
  const { data, error } = await client.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (error) throw new Error(`hydrateMatch: matches query failed: ${error.message}`);
  return data ? mapMatchRowFromDb(data as Record<string, unknown>) : null;
}
