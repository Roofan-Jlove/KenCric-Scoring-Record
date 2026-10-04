/**
 * TASK-0147: a real, but deliberately minimal, `BattingContext` for
 * `pushEvents.ts`'s own `V8` check -- picked after "mint the next task
 * and continue" with no further direction, the only remaining
 * candidate from the prior survey that is a bounded backend task
 * rather than a new epic needing fresh specs (i18n/push delivery,
 * competitions, auth are all delegated/out-of-scope).
 *
 * **This is NOT a port of `shared/`'s own `InningsFolder.kt`** --
 * checked that file directly before writing anything: it is a 185-line
 * fold producing the FULL `InningsFoldState` (`batterCardLines`/
 * `bowlerCardLines`/`score`/`over`/`strikerBatterId`/
 * `nonStrikerBatterId`/`freeHitPending`), the real run-scoring engine,
 * an undertaking on the order of `TASK-0144` or larger. `V8` itself
 * only checks THREE set-membership facts
 * (`battingXiPlayerIds`/`alreadyBattedPlayerIds`/`notOutPlayerIds`) --
 * this module derives exactly those three, nothing else, a genuinely
 * narrower slice, the same "a flagged approximation, not the real
 * thing" discipline `matches.ts`'s own `validateFrozenFields` (`TASK-
 * 0044`) already used.
 *
 * **A real simplification found, not assumed:** `DeliveryInput` already
 * carries `strikerBatterId`/`nonStrikerBatterId` directly on EVERY
 * delivery (the device supplies them, same as every other field) --
 * `WicketDetail.outBatterId`/`incomingBatterId` are likewise explicit,
 * never inferred from "whoever is currently on strike." This means the
 * only fact that genuinely needs to persist ACROSS deliveries is the
 * accumulated set of dismissed players for the active innings --
 * who's currently at the crease is read straight off the very delivery
 * being validated, never folded from history. No strike-rotation logic
 * is implemented here at all; `V8` never needs it.
 *
 * **A real, pre-existing gap found and worked around, not silently
 * invented past:** there is no event type anywhere in this backlog's
 * own `MatchEvent` sealed class (`DeliveryRecorded`/`NonStrikerRunOut`/
 * `StrikerOverridden`/`PlayingConditionsFrozen`/`DeliveryVoided` -- all
 * five checked directly) that establishes which team is batting or who
 * the two openers are. `matches.ts`'s own `homeXi`/`awayXi` fields are
 * typed `unknown | null` for the same reason -- no document in this
 * backlog ever pinned their concrete shape down (confirmed by reading
 * `matches.ts` directly; `TASK-0044`'s own frozen-field handling never
 * needed to look inside them). `UX-07`'s own `playingXiForm.ts`
 * (`TASK-0049`) is the one place a concrete shape already exists --
 * `SideXiState.selectedIds: readonly string[]` -- never wired to
 * `matches.ts`'s own persistence. `resolveBattingXi` below treats
 * `homeXi`/`awayXi` as that same `string[]` shape via a runtime check,
 * reusing `UX-07`'s own established convention rather than inventing a
 * new one, falling back to `EMPTY_BATTING_CONTEXT`'s behavior (today's
 * exact behavior) when absent or malformed.
 *
 * **`BattingStateStore.seed` is a caller-invoked lifecycle action, not
 * wired to any event** -- the same "take the missing service as a
 * caller-supplied input" shape `signOffMatch.ts`'s `SVC-RECONCILER`
 * port and `mergePlayers.ts`'s `PlayerAppearanceLookup` already used,
 * since no command or event in this backlog ever establishes "an
 * innings has started" or "these two openers are in." Whoever
 * eventually builds that command calls `seed` at the right moment;
 * this module does not invent one. **No multi-innings modeling at
 * all** -- one active `BattingInningsState` per `matchId`, overwritten
 * (not appended) by `seed`, matching this module's own single-innings
 * scope boundary.
 */

import type { MatchRow, MatchStore } from "../commands/matches.js";
import { EMPTY_BATTING_CONTEXT, type BattingContext } from "./deliveryValidator.js";

export interface BattingInningsState {
  battingTeamId: string;
  dismissedPlayerIds: ReadonlySet<string>;
}

export interface BattingStateStore {
  get(matchId: string): BattingInningsState | null;
  /** Overwrites the active innings state for `matchId` -- resets `dismissedPlayerIds` to empty. */
  seed(matchId: string, battingTeamId: string): void;
  /** Idempotent -- recording the same `playerId` twice leaves the set unchanged. */
  recordDismissal(matchId: string, playerId: string): void;
}

/** See this module's own doc comment: a flagged reuse of `UX-07`'s own `string[]` convention, not `matches.ts`'s own (unconstrained) `unknown` type. */
function resolveBattingXi(match: MatchRow, battingTeamId: string): ReadonlySet<string> | null {
  const xi = battingTeamId === match.homeTeamId ? match.homeXi : battingTeamId === match.awayTeamId ? match.awayXi : null;
  if (!Array.isArray(xi) || !xi.every((id) => typeof id === "string")) return null;
  return new Set(xi as string[]);
}

/**
 * Derives the three `V8` set-membership facts for one delivery.
 * Returns `EMPTY_BATTING_CONTEXT` (today's exact fallback behavior,
 * unchanged) whenever the innings hasn't been seeded, the match can't
 * be found, or the batting side's XI isn't yet a recognisable
 * `string[]` -- never throws, never invents a value it can't support.
 */
export function deriveBattingContext(matchId: string, strikerBatterId: string, nonStrikerBatterId: string, matchStore: MatchStore, battingStateStore: BattingStateStore): BattingContext {
  const state = battingStateStore.get(matchId);
  if (!state) return EMPTY_BATTING_CONTEXT;

  const match = matchStore.get(matchId);
  if (!match) return EMPTY_BATTING_CONTEXT;

  const battingXiPlayerIds = resolveBattingXi(match, state.battingTeamId);
  if (!battingXiPlayerIds) return EMPTY_BATTING_CONTEXT;

  const alreadyBattedPlayerIds = new Set<string>([...state.dismissedPlayerIds, strikerBatterId, nonStrikerBatterId]);
  const notOutPlayerIds = new Set<string>([...battingXiPlayerIds].filter((id) => !state.dismissedPlayerIds.has(id)));

  return { battingXiPlayerIds, alreadyBattedPlayerIds, notOutPlayerIds };
}

/** An in-memory BattingStateStore for tests -- not a production adapter. */
export class InMemoryBattingStateStore implements BattingStateStore {
  private readonly states = new Map<string, { battingTeamId: string; dismissedPlayerIds: Set<string> }>();

  get(matchId: string): BattingInningsState | null {
    const state = this.states.get(matchId);
    return state ? { battingTeamId: state.battingTeamId, dismissedPlayerIds: state.dismissedPlayerIds } : null;
  }

  seed(matchId: string, battingTeamId: string): void {
    this.states.set(matchId, { battingTeamId, dismissedPlayerIds: new Set() });
  }

  recordDismissal(matchId: string, playerId: string): void {
    this.states.get(matchId)?.dismissedPlayerIds.add(playerId);
  }
}
