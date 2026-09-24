/**
 * TASK-0049: `ux-specification.md UX-07` -- Playing XI. Grounded directly
 * in `acceptance-criteria.md` cluster C's concrete cases (`N-C1`, `B-C1`,
 * `I-C1`, `I-C2`), all of which are scoped to this exact screen (unlike
 * `UX-06`'s TASK-0047, where cluster C turned out to be scoped elsewhere).
 *
 * ONE FLAGGED INFERENCE: `UX-07`'s own Inputs list "captain picker,
 * wicket-keeper picker" without stating the picker's candidate pool
 * explicitly. `setCaptain`/`setKeeper` require the player to already be
 * toggled into the XI (`selectedIds`) -- the natural reading given
 * `N-C1`'s own wording ("11 players selected with one marked captain and
 * one marked keeper") describes marking roles among the selected XI, not
 * the wider squad.
 */

export interface Player {
  id: string;
  name: string;
  isAdHoc: boolean;
}

export interface SideXiState {
  squad: readonly Player[];
  selectedIds: readonly string[];
  captainId: string | null;
  keeperId: string | null;
}

export interface PlayingXiState {
  sideA: SideXiState;
  sideB: SideXiState;
}

export function initialSideXiState(squad: readonly Player[]): SideXiState {
  return { squad, selectedIds: [], captainId: null, keeperId: null };
}

export type ToggleResult = { outcome: "toggled"; state: SideXiState } | { outcome: "blocked"; reason: string };

/**
 * UX-07's own Error handling: "Attempting an over-count selection is
 * blocked at the moment of the extra tap ('XI is full -- remove someone
 * first'), not after Continue is pressed."
 *
 * Removing a player who was holding the captain/keeper role also clears
 * that role -- an inferred invariant (a captain/keeper can't be someone
 * outside the XI), not stated verbatim in `UX-07` but required for the
 * state to stay internally consistent.
 */
export function togglePlayer(state: SideXiState, playerId: string, requiredXiSize: number): ToggleResult {
  const isSelected = state.selectedIds.includes(playerId);
  if (isSelected) {
    return {
      outcome: "toggled",
      state: {
        ...state,
        selectedIds: state.selectedIds.filter((id) => id !== playerId),
        captainId: state.captainId === playerId ? null : state.captainId,
        keeperId: state.keeperId === playerId ? null : state.keeperId,
      },
    };
  }
  if (state.selectedIds.length >= requiredXiSize) {
    return { outcome: "blocked", reason: "XI is full — remove someone first" };
  }
  return { outcome: "toggled", state: { ...state, selectedIds: [...state.selectedIds, playerId] } };
}

export type SetRoleResult = { outcome: "set"; state: SideXiState } | { outcome: "rejected"; reason: string };

/**
 * `I-C2` ("two players both marked as captain for one side... rejected")
 * is satisfied structurally, not by a runtime check: `captainId` is a
 * single nullable field, not a list, so "two captains" has no
 * representation in this state shape at all -- setting a second captain
 * simply replaces the first, matching `UX-07`'s own Accessibility text
 * ("captain/keeper pickers use single-select (radio) semantics").
 */
export function setCaptain(state: SideXiState, playerId: string): SetRoleResult {
  if (!state.selectedIds.includes(playerId)) {
    return { outcome: "rejected", reason: "Captain must be selected in the XI" };
  }
  return { outcome: "set", state: { ...state, captainId: playerId } };
}

export function setKeeper(state: SideXiState, playerId: string): SetRoleResult {
  if (!state.selectedIds.includes(playerId)) {
    return { outcome: "rejected", reason: "Wicket-keeper must be selected in the XI" };
  }
  return { outcome: "set", state: { ...state, keeperId: playerId } };
}

export type AddAdHocResult = { outcome: "added"; state: SideXiState } | { outcome: "blocked"; reason: string };

/** UX-07's own Actions: "Add an ad-hoc player mid-selection" -- adds to the squad and immediately into the XI. */
export function addAdHocPlayer(
  state: SideXiState,
  name: string,
  requiredXiSize: number,
  newPlayerId: string,
): AddAdHocResult {
  const player: Player = { id: newPlayerId, name, isAdHoc: true };
  const withPlayer: SideXiState = { ...state, squad: [...state.squad, player] };
  const toggled = togglePlayer(withPlayer, newPlayerId, requiredXiSize);
  if (toggled.outcome === "blocked") {
    return { outcome: "blocked", reason: toggled.reason };
  }
  return { outcome: "added", state: toggled.state };
}

export interface SideValidationIssue {
  side: "A" | "B";
  issue: "count" | "captain" | "keeper";
  message: string;
}

/** Drives UX-07's own Error handling: "a Continue attempt with no keeper marked shows an inline error...". */
export function sideValidationIssues(state: SideXiState, side: "A" | "B", requiredXiSize: number): SideValidationIssue[] {
  const issues: SideValidationIssue[] = [];
  if (state.selectedIds.length !== requiredXiSize) {
    issues.push({ side, issue: "count", message: `Team ${side}: ${state.selectedIds.length} of ${requiredXiSize} selected` });
  }
  if (state.captainId === null) {
    issues.push({ side, issue: "captain", message: `Team ${side}: captain required` });
  }
  if (state.keeperId === null) {
    issues.push({ side, issue: "keeper", message: `Team ${side}: wicket-keeper required` });
  }
  return issues;
}

/** `N-C1`/`B-C1`: exact count, exactly one captain, exactly one keeper. */
export function sideIsValid(state: SideXiState, requiredXiSize: number): boolean {
  return state.selectedIds.length === requiredXiSize && state.captainId !== null && state.keeperId !== null;
}

/** `I-C1`: "the same `player_id` selected in both sides' XIs... identifying that specific player id." */
export function findDuplicatePlayerId(state: PlayingXiState): string | null {
  const sideASet = new Set(state.sideA.selectedIds);
  for (const id of state.sideB.selectedIds) {
    if (sideASet.has(id)) return id;
  }
  return null;
}

export function canContinue(state: PlayingXiState, requiredXiSize: number): boolean {
  if (!sideIsValid(state.sideA, requiredXiSize)) return false;
  if (!sideIsValid(state.sideB, requiredXiSize)) return false;
  return findDuplicatePlayerId(state) === null;
}
