/**
 * TASK-0047: `ux-specification.md UX-06`'s own logic.
 *
 * SCOPE NOTE: `acceptance-criteria.md`'s cluster C entries found so far
 * (`N-C1`, `B-C1`) are all scoped to `UX-07` (captain/keeper/XI-count),
 * not this screen -- there is no cluster-C case yet for `UX-06`'s own
 * "two distinct teams" rule, so this module is grounded directly in
 * `UX-06`'s own Validation/Error-handling text instead, flagged rather
 * than a citation silently assumed to exist.
 */

export interface Team {
  id: string;
  name: string;
  isAdHoc: boolean;
}

export interface Player {
  id: string;
  name: string;
  isAdHoc: boolean;
}

export interface TeamSelectionState {
  teamA: Team | null;
  teamB: Team | null;
  squadA: readonly Player[];
  squadB: readonly Player[];
}

export function initialTeamSelectionState(): TeamSelectionState {
  return { teamA: null, teamB: null, squadA: [], squadB: [] };
}

/**
 * UX-06's own Error handling: "Selecting the same team on both sides is
 * blocked immediately with an explanation, not deferred to Continue."
 * Callers check this BEFORE committing a selection -- see
 * `selectTeam()`'s own doc comment for how that's enforced structurally,
 * not just by convention.
 */
export function teamsAreDistinct(state: TeamSelectionState): boolean {
  if (state.teamA === null || state.teamB === null) return true; // nothing to conflict with yet
  return state.teamA.id !== state.teamB.id;
}

export type SelectTeamResult =
  | { outcome: "selected"; state: TeamSelectionState }
  | { outcome: "rejected"; reason: string };

/**
 * Attempts to select [team] for [side]. Rejects immediately (never
 * mutates the state) if it would make both sides the same team --
 * this is what makes UX-06's "blocked immediately... not deferred to
 * Continue" rule structurally true: there is no code path that can
 * produce a same-team state via this function at all.
 */
export function selectTeam(state: TeamSelectionState, side: "A" | "B", team: Team): SelectTeamResult {
  const other = side === "A" ? state.teamB : state.teamA;
  if (other !== null && other.id === team.id) {
    return { outcome: "rejected", reason: `${team.name} is already selected for the other side` };
  }
  const nextState =
    side === "A" ? { ...state, teamA: team, squadA: [] } : { ...state, teamB: team, squadB: [] };
  return { outcome: "selected", state: nextState };
}

export function swapSides(state: TeamSelectionState): TeamSelectionState {
  return { teamA: state.teamB, teamB: state.teamA, squadA: state.squadB, squadB: state.squadA };
}

export function addPlayer(state: TeamSelectionState, side: "A" | "B", player: Player): TeamSelectionState {
  return side === "A" ? { ...state, squadA: [...state.squadA, player] } : { ...state, squadB: [...state.squadB, player] };
}

export function removePlayer(state: TeamSelectionState, side: "A" | "B", playerId: string): TeamSelectionState {
  return side === "A"
    ? { ...state, squadA: state.squadA.filter((p) => p.id !== playerId) }
    : { ...state, squadB: state.squadB.filter((p) => p.id !== playerId) };
}

/** UX-06's own Validation: "squad size ≥ the configured XI size before Continue." */
export function squadMeetsMinimum(squad: readonly Player[], requiredXiSize: number): boolean {
  return squad.length >= requiredXiSize;
}

/** UX-06's own Validation: "Two distinct teams required... squad size ≥ the configured XI size before Continue." */
export function canContinue(state: TeamSelectionState, requiredXiSize: number): boolean {
  if (state.teamA === null || state.teamB === null) return false;
  if (!teamsAreDistinct(state)) return false;
  return squadMeetsMinimum(state.squadA, requiredXiSize) && squadMeetsMinimum(state.squadB, requiredXiSize);
}

export type TeamSearchState =
  | { status: "loading" }
  | { status: "populated"; teams: readonly Team[]; isFromCache: boolean }
  | { status: "empty" }
  | { status: "fetch-failed-fallback-to-cache"; teams: readonly Team[] }
  | { status: "fetch-failed-no-cache" };

/**
 * UX-06's own States/Error-handling/Empty-states, unified: "No results
 * (offers ad-hoc create)"; "a search performed offline returns only
 * cached/local matches with a note that results may be incomplete."
 * Same shape as `TASK-0045`'s `resolveTemplateListState` (a genuinely
 * recurring pattern across screens with a registry-search-plus-offline-
 * cache concern), kept as its own function rather than factored into a
 * shared utility -- each screen module has stayed self-contained so
 * far, and extracting a shared helper is a real, deferrable refactor,
 * not required by this task's own scope.
 */
export function resolveTeamSearchState(
  fetchSucceeded: boolean,
  fetchedTeams: readonly Team[] | null,
  cachedTeams: readonly Team[],
): TeamSearchState {
  if (fetchSucceeded && fetchedTeams !== null) {
    return fetchedTeams.length === 0
      ? { status: "empty" }
      : { status: "populated", teams: fetchedTeams, isFromCache: false };
  }
  if (cachedTeams.length > 0) return { status: "fetch-failed-fallback-to-cache", teams: cachedTeams };
  return { status: "fetch-failed-no-cache" };
}
