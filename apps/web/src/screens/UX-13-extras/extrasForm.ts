/**
 * TASK-0061: `ux-specification.md UX-13` -- Extras, type-selection/
 * composition layer. This screen's output feeds `shared/`'s existing
 * `ExtrasDecomposer.kt` (built `TASK-0020`, already implements the
 * correct `RunEvent`-construction rules for wide/no-ball/bye/leg-bye/
 * penalty) -- it is NOT a second implementation of that logic.
 *
 * CITATION NOTE: `UX-13`'s Trace `FR-044/046/047` are SRS-level (wide;
 * byes/leg-byes; penalty) -- confirms `TASK-0057`'s own prediction that
 * these are `UX-13`'s real territory, not `UX-11`'s (where they showed
 * up as a cross-namespace double-citation of unrelated requirements).
 * **Flagged gap:** SRS `FR-045` ("Record a no-ball") is on-topic --
 * `UX-13`'s own Purpose names "no-ball" as one of five extra types --
 * but is missing from the Trace line; not silently added here.
 * `BR-034/035/036` are discovery-level (matching this screen's own
 * Validation text verbatim), not SRS's own unrelated same-numbered
 * entries -- same direction as `TASK-0059`'s finding.
 */

export type ExtraType = "WIDE" | "NO_BALL" | "BYE" | "LEG_BYE" | "PENALTY";

export type PenaltyRecipientSide = "BATTING" | "BOWLING";

export interface ExtrasFormState {
  type: ExtraType | null;
  additionalRuns: number;
  penaltyReason: string;
  penaltyRecipientSide: PenaltyRecipientSide | null;
}

export function initialExtrasFormState(): ExtrasFormState {
  return { type: null, additionalRuns: 0, penaltyReason: "", penaltyRecipientSide: null };
}

/**
 * `BR-034`/`BR-035`: "byes and leg-byes... count as legal deliveries";
 * "wides and no-balls do not count as legal deliveries." Penalty is
 * `false` "by default" per `DR-16`'s config-dependent ball-counted/not-
 * counted framing -- a flagged simplification, not the full variant
 * handling.
 */
export function consumesLegalBall(type: ExtraType): boolean {
  return type === "BYE" || type === "LEG_BYE";
}

/** UX-13's own Validation: "a type disabled by the current playing-conditions profile is shown but not selectable" -- `enabledTypes` is caller-supplied, this screen has no visibility into the full CFG-REG registry. */
export function isTypeEnabled(type: ExtraType, enabledTypes: ReadonlySet<ExtraType>): boolean {
  return enabledTypes.has(type);
}

export type SubmitResult = { outcome: "valid"; state: ExtrasFormState } | { outcome: "invalid"; reason: string };

/** `BR-036`: "Penalty runs... require a reason." Also enforces the recipient side and a non-negative integer additional-runs value for every type. */
export function validateSubmission(state: ExtrasFormState): SubmitResult {
  if (state.type === null) {
    return { outcome: "invalid", reason: "Select an extra type" };
  }
  if (!Number.isInteger(state.additionalRuns) || state.additionalRuns < 0) {
    return { outcome: "invalid", reason: "Additional runs must be a non-negative integer" };
  }
  if (state.type === "PENALTY") {
    if (state.penaltyReason.trim() === "") {
      return { outcome: "invalid", reason: "A penalty requires a reason" };
    }
    if (state.penaltyRecipientSide === null) {
      return { outcome: "invalid", reason: "Select the penalty recipient side" };
    }
  }
  return { outcome: "valid", state };
}
