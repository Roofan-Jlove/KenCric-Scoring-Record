/**
 * TASK-0059: `ux-specification.md UX-12` -- Wicket Entry, mode-selection/
 * detail-form layer.
 *
 * `DismissalMode`, `FIELDER_REQUIRED_MODES`, `Legality`, and
 * `validDismissalModesFor` below are a direct TypeScript mirror of
 * `shared/src/commonMain/.../core/model/{DismissalMode,Legality}.kt`
 * (built since `TASK-0017`/`0021`) -- REUSED logic, not reinvented; kept
 * in sync field-for-field the same way `apps/web/src/core/
 * sharedCoreStub.ts` stands in for the uncompiled shared core elsewhere
 * in this codebase.
 *
 * CITATION NOTE: `UX-12`'s Trace `BR-030/031/032/033` are discovery-
 * level numbers (matching this screen's own Validation text verbatim),
 * NOT SRS's own same-numbered, unrelated `BR-030…033` (Super Over rules,
 * player-merge authority, reference-data versioning, timeline-is-the-
 * record). `FR-049`/`FR-050` correctly ARE SRS's own numbers here.
 *
 * `NON_STRIKER_RUN_OUT` does not appear below -- it is not a
 * `DismissalMode` value at all in the real domain model (a pre-delivery
 * mankad, `§9.6`, with no `DeliveryInput`/`WicketDetail` shape yet, an
 * already-logged open gap) -- excluded from this screen's mode picker
 * rather than fabricated.
 */

export type DismissalMode =
  | "BOWLED"
  | "CAUGHT"
  | "LBW"
  | "RUN_OUT"
  | "STUMPED"
  | "HIT_WICKET"
  | "OBSTRUCTING_THE_FIELD"
  | "HIT_BALL_TWICE"
  | "TIMED_OUT"
  | "RETIRED_OUT";

export const FIELDER_REQUIRED_MODES: ReadonlySet<DismissalMode> = new Set(["CAUGHT"]);

export type Legality = "LEGAL" | "WIDE" | "NO_BALL" | "DEAD_BALL";

/** Direct mirror of `shared/`'s `validDismissalModesFor` -- BR-032/BR-033's exact rules, already built and tested there. */
export function validDismissalModesFor(legality: Legality, isFreeHit: boolean): ReadonlySet<DismissalMode> {
  if (legality === "LEGAL" && isFreeHit) {
    return new Set(["RUN_OUT", "OBSTRUCTING_THE_FIELD", "HIT_BALL_TWICE"]);
  }
  if (legality === "LEGAL") {
    return new Set(["BOWLED", "CAUGHT", "LBW", "RUN_OUT", "STUMPED", "HIT_WICKET", "OBSTRUCTING_THE_FIELD", "HIT_BALL_TWICE"]);
  }
  if (legality === "NO_BALL") {
    return new Set(["RUN_OUT", "OBSTRUCTING_THE_FIELD", "HIT_BALL_TWICE"]);
  }
  if (legality === "WIDE") {
    // HIT_WICKET off a wide is [OPEN] in §9.1 -- not offered, matching the stated default.
    return new Set(["RUN_OUT", "STUMPED", "OBSTRUCTING_THE_FIELD", "HIT_BALL_TWICE"]);
  }
  return new Set(); // DEAD_BALL
}

/**
 * `TIMED_OUT`/`RETIRED_OUT` are "not tied to a delivery" per `shared/`'s
 * own `WicketDetail.kt` comment, so `validDismissalModesFor`'s per-
 * legality/free-hit restriction doesn't apply to them -- always offered.
 * A flagged, interpretive bridge between the domain model's own scope
 * note and `UX-12`'s Inputs list (which names them as regular picker
 * options), not verbatim spec text.
 */
export function modeIsOffered(mode: DismissalMode, legality: Legality, isFreeHit: boolean): boolean {
  if (mode === "TIMED_OUT" || mode === "RETIRED_OUT") return true;
  return validDismissalModesFor(legality, isFreeHit).has(mode);
}

/** UX-12's own Error handling: "a mode invalid for the current context... with a one-line reason available on request." */
export function reasonModeNotOffered(mode: DismissalMode, legality: Legality, isFreeHit: boolean): string | null {
  if (modeIsOffered(mode, legality, isFreeHit)) return null;
  if (isFreeHit) return "Only run out, obstructing the field, or hit the ball twice are available on a free hit";
  if (legality === "NO_BALL") return "Only run out, obstructing the field, or hit the ball twice are available off a no-ball";
  if (legality === "WIDE" && mode !== "HIT_WICKET") {
    return "Not available off a wide";
  }
  if (legality === "WIDE" && mode === "HIT_WICKET") {
    return "Not currently offered off a wide";
  }
  if (legality === "DEAD_BALL") return "No dismissal can be recorded on a dead ball";
  return "Not available in this context";
}

export type CreaseEnd = "STRIKER" | "NON_STRIKER";

export interface WicketFormState {
  mode: DismissalMode | null;
  outBatterId: string | null;
  endVacated: CreaseEnd | null;
  fielderIds: string[];
  crossedBeforeDismissal: boolean | null;
  incomingBatterId: string | null;
}

export function initialWicketFormState(): WicketFormState {
  return { mode: null, outBatterId: null, endVacated: null, fielderIds: [], crossedBeforeDismissal: null, incomingBatterId: null };
}

export type RequiredField = "fielderIds" | "crossedBeforeDismissal";

/** UX-12's own Validation: "Mode-specific required fields (e.g. caught requires a fielder; run out requires an end)." */
export function requiredFieldsForMode(mode: DismissalMode): RequiredField[] {
  const fields: RequiredField[] = [];
  if (FIELDER_REQUIRED_MODES.has(mode)) fields.push("fielderIds");
  if (mode === "RUN_OUT") fields.push("crossedBeforeDismissal");
  return fields;
}

export interface MissingField {
  field: RequiredField | "mode" | "outBatterId" | "endVacated" | "incomingBatterId";
  message: string;
}

/**
 * `endVacated` and `outBatterId` are always required (`WicketDetail`'s
 * own non-nullable fields); `incomingBatterId` is required unless the
 * caller says this dismissal ends the innings (`WicketDetail.kt`'s own
 * comment: "Null only when the innings ends on this wicket").
 */
export function missingFields(state: WicketFormState, endsInnings: boolean): MissingField[] {
  const missing: MissingField[] = [];
  if (state.mode === null) {
    missing.push({ field: "mode", message: "Select a dismissal mode" });
    return missing;
  }
  if (state.outBatterId === null) missing.push({ field: "outBatterId", message: "Select the out batter" });
  if (state.endVacated === null) missing.push({ field: "endVacated", message: "Select the end vacated" });
  for (const field of requiredFieldsForMode(state.mode)) {
    if (field === "fielderIds" && state.fielderIds.length === 0) {
      missing.push({ field: "fielderIds", message: "Select the fielder" });
    }
    if (field === "crossedBeforeDismissal" && state.crossedBeforeDismissal === null) {
      missing.push({ field: "crossedBeforeDismissal", message: "Select whether the batters crossed" });
    }
  }
  if (!endsInnings && state.incomingBatterId === null) {
    missing.push({ field: "incomingBatterId", message: "Select the incoming batter" });
  }
  return missing;
}

export function canConfirm(state: WicketFormState, endsInnings: boolean): boolean {
  return missingFields(state, endsInnings).length === 0;
}
