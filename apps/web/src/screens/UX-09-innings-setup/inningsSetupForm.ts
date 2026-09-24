/**
 * TASK-0053: `ux-specification.md UX-09` -- Innings Setup.
 *
 * CITATION NOTE (see this task's own backlog entry for the full trail):
 * `UX-09`'s Trace line cites `FR-042`, the SRS's own renumbered `FR-042`
 * ("Set the opening striker, non-striker and bowler," `Must/P1`) -- NOT
 * discovery's own `FR-042` ("Lock lineup at deadline," `Should/P2`, an
 * unrelated requirement). Same numbering-namespace collision `TASK-0051`
 * found for `FR-023`.
 */

export interface Player {
  id: string;
  name: string;
}

export interface InningsSetupState {
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
}

export function initialInningsSetupState(): InningsSetupState {
  return { strikerId: null, nonStrikerId: null, bowlerId: null };
}

export type SelectResult = { outcome: "selected"; state: InningsSetupState } | { outcome: "rejected"; reason: string };

/**
 * UX-09's own Error handling: "Selecting the same person as striker and
 * non-striker is blocked inline." Also enforces Validation's "batters
 * must come from the batting side's XI" -- flagged as implemented
 * symmetrically with the bowler's wrong-side check even though only the
 * bowler case gets its own dedicated Error-handling sentence.
 */
export function selectStriker(
  state: InningsSetupState,
  playerId: string,
  battingXi: readonly Player[],
  battingSideName: string,
): SelectResult {
  if (!battingXi.some((p) => p.id === playerId)) {
    return { outcome: "rejected", reason: `The striker must be from ${battingSideName}'s XI` };
  }
  if (state.nonStrikerId === playerId) {
    return { outcome: "rejected", reason: "This player is already selected as non-striker" };
  }
  return { outcome: "selected", state: { ...state, strikerId: playerId } };
}

export function selectNonStriker(
  state: InningsSetupState,
  playerId: string,
  battingXi: readonly Player[],
  battingSideName: string,
): SelectResult {
  if (!battingXi.some((p) => p.id === playerId)) {
    return { outcome: "rejected", reason: `The non-striker must be from ${battingSideName}'s XI` };
  }
  if (state.strikerId === playerId) {
    return { outcome: "rejected", reason: "This player is already selected as striker" };
  }
  return { outcome: "selected", state: { ...state, nonStrikerId: playerId } };
}

/** UX-09's own Error handling: "picking a bowler from the wrong side is blocked with an explanation naming the correct side." */
export function selectBowler(
  state: InningsSetupState,
  playerId: string,
  fieldingXi: readonly Player[],
  fieldingSideName: string,
): SelectResult {
  if (!fieldingXi.some((p) => p.id === playerId)) {
    return { outcome: "rejected", reason: `The opening bowler must be from ${fieldingSideName}'s XI` };
  }
  return { outcome: "selected", state: { ...state, bowlerId: playerId } };
}

/** UX-09's own Actions: "Swap striker/non-striker." */
export function swapEnds(state: InningsSetupState): InningsSetupState {
  return { ...state, strikerId: state.nonStrikerId, nonStrikerId: state.strikerId };
}

/**
 * `selectStriker`/`selectNonStriker` structurally prevent the same
 * player ever occupying both roles, so this distinctness check is a
 * defensive confirmation of that invariant, not a reachable failure path.
 */
export function canConfirm(state: InningsSetupState): boolean {
  if (state.strikerId === null || state.nonStrikerId === null || state.bowlerId === null) return false;
  return state.strikerId !== state.nonStrikerId;
}

export type ConfirmResult = { outcome: "started"; state: InningsSetupState } | { outcome: "rejected"; reason: string };

export function confirmAndStart(state: InningsSetupState): ConfirmResult {
  if (!canConfirm(state)) {
    return { outcome: "rejected", reason: "Select striker, non-striker, and opening bowler before starting" };
  }
  return { outcome: "started", state };
}
