/**
 * TASK-0063: `ux-specification.md UX-14` -- Strike Change, manual-
 * override layer.
 *
 * `shared/`'s existing `StrikeResolver.kt` (`TASK-0025`) implements
 * `live-scoring.md §14.2`'s automatic derivation, but its own "HONEST
 * SCOPE NOTE" explicitly says `§14.5` (manual override) is "Not
 * implemented here" -- this module is the first real coverage of the
 * override mechanism itself.
 *
 * FLAGGED TENSION, NOT RESOLVED: `UX-14`'s own Error-handling text ("An
 * override with no not-out batters available to swap to is not
 * reachable") implies a richer not-out-batter candidate pool than a
 * strict two-person swap can ever have -- under a strict swap the
 * partner is always exactly 1 person, never an empty pool. This module
 * implements the strict-swap model, since it's what `§14.5`'s rule text
 * and `domain-model.md`'s `CMD-OVERRIDE-STRIKER` shape (`newStrikerId`
 * singular, not a free pick from the wider XI) most directly support.
 */

export interface StrikePositions {
  strikerId: string;
  nonStrikerId: string;
}

export type StrikeChangeState = "AUTO" | "PENDING_OVERRIDE" | "OVERRIDDEN";

export interface StrikeChangeFormState {
  status: StrikeChangeState;
  positions: StrikePositions;
  reason: string;
}

export function initialStrikeChangeFormState(positions: StrikePositions): StrikeChangeFormState {
  return { status: "AUTO", positions, reason: "" };
}

/** UX-14's own Actions: "Tap 'Swap ends'" -- opens the reason field, does not apply anything yet. */
export function toggleSwap(state: StrikeChangeFormState): StrikeChangeFormState {
  return { ...state, status: "PENDING_OVERRIDE" };
}

export function cancelSwap(state: StrikeChangeFormState): StrikeChangeFormState {
  return { ...state, status: "AUTO", reason: "" };
}

export type ConfirmOverrideResult =
  | { outcome: "overridden"; state: StrikeChangeFormState }
  | { outcome: "rejected"; reason: string };

/** `§14.5`: "requires a non-empty reason." Swaps the current pair -- `newStrikerId` is the current non-striker, matching `CMD-OVERRIDE-STRIKER`'s own shape. */
export function confirmOverride(state: StrikeChangeFormState, reason: string): ConfirmOverrideResult {
  if (reason.trim() === "") {
    return { outcome: "rejected", reason: "An override requires a reason" };
  }
  const swapped: StrikePositions = { strikerId: state.positions.nonStrikerId, nonStrikerId: state.positions.strikerId };
  return {
    outcome: "overridden",
    state: { status: "OVERRIDDEN", positions: swapped, reason: reason.trim() },
  };
}

/** `§14.5`: "never 'sticky' beyond the one delivery it targets" -- the next delivery's display state resets to auto-derived. */
export function resetToAutoForNextDelivery(state: StrikeChangeFormState, autoDerivedPositions: StrikePositions): StrikeChangeFormState {
  return { status: "AUTO", positions: autoDerivedPositions, reason: "" };
}
