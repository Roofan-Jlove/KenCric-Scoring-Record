/**
 * TASK-0045: `ux-specification.md UX-05`'s own logic, grounded directly
 * in `acceptance-criteria.md` cluster B's concrete cases (`N-B1`,
 * `B-B1`, `I-B1`), not just the UX entry's prose -- the same "read the
 * actual governing text, not the paraphrase" discipline this session
 * has applied throughout.
 *
 * SCOPE DECISIONS, flagged rather than silently assumed:
 * - Must-have fields (gate `Continue`, `BR-002`): `oversAllotted` and
 *   `matchTimezone` only -- the two fields `UX-05`'s own Validation
 *   text and `N-B1`/`B-B1` state explicit rules for. Every other Input
 *   UX-05 lists (powerplay, bowler cap, tie-breaker, venue, date/time,
 *   officials, minOversForResult) is treated as OPTIONAL but validated
 *   when present -- UX-05's own text never actually says these are
 *   must-have, only that the numeric ones must be "positive integers
 *   within sane bounds" and mutually consistent if given.
 * - "ball type" is explicitly tagged `(V1)` in UX-05's own Inputs list
 *   -- V1/future scope (`FA-8`), not built here at all.
 * - "bowler cap consistent with total overs" is implemented as
 *   `bowlerOverCap <= oversAllotted` -- the same shape as the
 *   explicitly-tested `powerplayOvers` rule (`I-B1`). A richer "enough
 *   overs exist to realistically distribute across a full bowling
 *   attack" check is not specified anywhere reachable and not built.
 * - `Locked` state (`§ States`: "unreachable once first ball is
 *   recorded"): this screen has no visibility into `match_events`,
 *   same gap `TASK-0044`'s `validateFrozenFields` already flagged --
 *   `isLocked` is a caller-supplied boolean, not derived here.
 */

export type TieBreakerRule = "SUPER_OVER" | "REPEAT" | "BOUNDARY_COUNTBACK" | "NONE";

export interface Official {
  name: string;
  role: string;
}

export interface MatchSetupFormState {
  oversAllotted: number | null;
  powerplayOvers: number | null;
  bowlerOverCap: number | null;
  tieBreakerRule: TieBreakerRule | null;
  venue: string | null;
  date: string | null;
  startTime: string | null;
  matchTimezone: string | null;
  officials: readonly Official[];
  minOversForResult: number | null;
}

export function initialMatchSetupState(): MatchSetupFormState {
  return {
    oversAllotted: null,
    powerplayOvers: null,
    bowlerOverCap: null,
    tieBreakerRule: null,
    venue: null,
    date: null,
    startTime: null,
    matchTimezone: null,
    officials: [],
    minOversForResult: null,
  };
}

export interface FieldError {
  field: string;
  message: string;
}

/**
 * `B-B1`: `overs_allotted = 1` (the smallest positive integer) is
 * accepted; `overs_allotted = 0` is rejected. `UX-05`'s own Validation:
 * "all numeric fields positive integers within sane bounds."
 */
export function validateOversAllotted(state: MatchSetupFormState): FieldError | null {
  if (state.oversAllotted === null) return { field: "oversAllotted", message: "Overs per innings is required" };
  if (!Number.isInteger(state.oversAllotted) || state.oversAllotted < 1) {
    return { field: "oversAllotted", message: "Overs per innings must be a positive integer" };
  }
  return null;
}

export function validateMatchTimezone(state: MatchSetupFormState): FieldError | null {
  if (!state.matchTimezone || state.matchTimezone.trim() === "") {
    return { field: "matchTimezone", message: "Match time zone is required" };
  }
  return null;
}

/**
 * `I-B1`: "Given `powerplayOvers > oversAllotted`... rejected,
 * flagging BOTH fields" -- returns errors for both field names, not
 * just `powerplayOvers`, matching that requirement precisely.
 */
export function validatePowerplayOvers(state: MatchSetupFormState): FieldError[] {
  if (state.powerplayOvers === null) return [];
  const errors: FieldError[] = [];
  if (!Number.isInteger(state.powerplayOvers) || state.powerplayOvers < 1) {
    errors.push({ field: "powerplayOvers", message: "Powerplay overs must be a positive integer" });
  }
  if (state.oversAllotted !== null && state.powerplayOvers > state.oversAllotted) {
    const message = "Powerplay overs cannot exceed overs per innings";
    errors.push({ field: "powerplayOvers", message });
    errors.push({ field: "oversAllotted", message });
  }
  return errors;
}

/** "Bowler cap consistent with total overs" -- same shape as the explicitly-tested powerplay rule. */
export function validateBowlerOverCap(state: MatchSetupFormState): FieldError[] {
  if (state.bowlerOverCap === null) return [];
  const errors: FieldError[] = [];
  if (!Number.isInteger(state.bowlerOverCap) || state.bowlerOverCap < 1) {
    errors.push({ field: "bowlerOverCap", message: "Bowler over cap must be a positive integer" });
  }
  if (state.oversAllotted !== null && state.bowlerOverCap > state.oversAllotted) {
    const message = "Bowler over cap cannot exceed overs per innings";
    errors.push({ field: "bowlerOverCap", message });
    errors.push({ field: "oversAllotted", message });
  }
  return errors;
}

/** "minimum-overs-for-result ≤ total overs." */
export function validateMinOversForResult(state: MatchSetupFormState): FieldError[] {
  if (state.minOversForResult === null) return [];
  const errors: FieldError[] = [];
  if (!Number.isInteger(state.minOversForResult) || state.minOversForResult < 1) {
    errors.push({ field: "minOversForResult", message: "Minimum overs for result must be a positive integer" });
  }
  if (state.oversAllotted !== null && state.minOversForResult > state.oversAllotted) {
    const message = "Minimum overs for result cannot exceed overs per innings";
    errors.push({ field: "minOversForResult", message });
    errors.push({ field: "oversAllotted", message });
  }
  return errors;
}

/** Every validation rule this screen defines, unified -- one pass, not four separately-called functions a caller might forget one of. */
export function validateAll(state: MatchSetupFormState): FieldError[] {
  const errors: FieldError[] = [];
  const oversError = validateOversAllotted(state);
  if (oversError) errors.push(oversError);
  const timezoneError = validateMatchTimezone(state);
  if (timezoneError) errors.push(timezoneError);
  errors.push(...validatePowerplayOvers(state));
  errors.push(...validateBowlerOverCap(state));
  errors.push(...validateMinOversForResult(state));
  return errors;
}

export interface MustHaveChecklistItem {
  field: string;
  label: string;
  complete: boolean;
}

/** UX-05's own States text: "a live checklist showing exactly what's missing" (BR-002). */
export function mustHaveChecklist(state: MatchSetupFormState): MustHaveChecklistItem[] {
  return [
    { field: "oversAllotted", label: "Overs per innings", complete: validateOversAllotted(state) === null },
    { field: "matchTimezone", label: "Match time zone", complete: validateMatchTimezone(state) === null },
  ];
}

/** N-B1: "matches.state advances only once every Must-have field is present" -- and, per I-B1, every cross-field check must also pass. */
export function canContinue(state: MatchSetupFormState): boolean {
  return mustHaveChecklist(state).every((item) => item.complete) && validateAll(state).length === 0;
}
