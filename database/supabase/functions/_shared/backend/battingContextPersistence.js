/**
 * Real wiring for V8's "named incoming batter" wicket-validation gap --
 * confirmed before writing anything: `sync-events/index.ts` never
 * passed `battingContextDeps` into `pushEvents()` at all, so
 * `deriveBattingContext` (battingContext.ts, TASK-0147 -- itself
 * already real, already tested, never touched here) was dead code in
 * the real deployed system, the identical "written but never wired"
 * shape the divergence-detection gap already had. This module is the
 * IO shell `deriveBattingContext`'s own doc comment explicitly leaves
 * to a future task: a real `MatchStore`/`BattingStateStore` pair,
 * seeded from real data, not invented.
 *
 * `BattingStateStore.seed()`'s own real "lifecycle action" is
 * deliberately NOT built as a persistent, separately-triggered step --
 * `battingTeamId` is instead derived fresh on every call, directly
 * from which of `matches.home_xi`/`away_xi` actually contains the
 * CURRENT delivery's own `strikerBatterId` (both fields are real
 * client-supplied data once a real XI is picked, per
 * `apps/web/src/App.tsx`'s own `createRealMatch`). This sidesteps the
 * open "no event establishes who's currently batting" gap entirely --
 * the striker's own team membership already answers that question for
 * free, more robustly than tracking a separate innings-number/toss
 * state would (correct across an innings change too, with zero extra
 * state). `dismissedPlayerIds` is derived fresh too, from every
 * already-accepted, non-voided `DELIVERY_RECORDED` event's own
 * `payload.wicket.outBatterId` for this match -- real history already
 * sitting in `match_events`, not a new table.
 *
 * Returns `undefined` (pushEvents' own existing EMPTY_BATTING_CONTEXT
 * fallback, unchanged) whenever the match can't be found or either
 * XI isn't yet a real `string[]` -- never invents a value it can't
 * support, matching `deriveBattingContext`'s/`resolveBattingXi`'s own
 * existing fallback discipline exactly.
 */

function isStringArray(value) {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

export async function hydrateBattingContextDeps(client, matchId, strikerBatterId) {
  const { data: matchRow, error: matchError } = await client
    .from("matches")
    .select("home_team_id,away_team_id,home_xi,away_xi")
    .eq("id", matchId)
    .maybeSingle();
  if (matchError) throw new Error(`hydrateBattingContextDeps: matches query failed: ${matchError.message}`);
  if (!matchRow) return undefined;

  const homeXi = isStringArray(matchRow.home_xi) ? matchRow.home_xi : null;
  const awayXi = isStringArray(matchRow.away_xi) ? matchRow.away_xi : null;
  if (!homeXi || !awayXi) return undefined;

  const battingTeamId = homeXi.includes(strikerBatterId)
    ? matchRow.home_team_id
    : awayXi.includes(strikerBatterId)
      ? matchRow.away_team_id
      : null;
  if (!battingTeamId) return undefined;

  const { data: eventRows, error: eventsError } = await client
    .from("match_events")
    .select("event_id,type,payload,voids")
    .eq("match_id", matchId);
  if (eventsError) throw new Error(`hydrateBattingContextDeps: match_events query failed: ${eventsError.message}`);

  const voidedIds = new Set((eventRows ?? []).filter((r) => r.voids).map((r) => r.voids));
  const dismissedPlayerIds = new Set();
  for (const row of eventRows ?? []) {
    if (row.type !== "DELIVERY_RECORDED" || voidedIds.has(row.event_id)) continue;
    const wicket = row.payload?.wicket;
    if (wicket?.outBatterId) dismissedPlayerIds.add(wicket.outBatterId);
  }

  const match = { id: matchId, homeTeamId: matchRow.home_team_id, awayTeamId: matchRow.away_team_id, homeXi, awayXi };
  const matchStore = {
    get: (id) => (id === matchId ? match : null),
    insert: () => {},
    update: () => {},
  };
  const store = {
    get: (id) => (id === matchId ? { battingTeamId, dismissedPlayerIds } : null),
    seed: () => {},
    recordDismissal: (id, playerId) => {
      if (id === matchId) dismissedPlayerIds.add(playerId);
    },
  };
  return { matchStore, store };
}
