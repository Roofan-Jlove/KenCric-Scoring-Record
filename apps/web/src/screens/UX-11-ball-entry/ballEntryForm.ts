/**
 * TASK-0057: `ux-specification.md UX-11` -- Ball Entry, composition/
 * validation layer only. This screen's output feeds the existing
 * `shared/` delivery-processing pipeline (`DeliveryValidator`,
 * `RunAggregator`, etc., built since `TASK-0017`) -- it is NOT a second
 * scoring engine. `NFR-001`'s "≤ 2 interactions" is satisfied
 * structurally by this composition shape itself (one tap commits the
 * primary value; the overthrow add-on is one optional second
 * interaction), not by a runtime interaction counter.
 *
 * CITATION NOTE: `UX-11`'s Trace `FR-043/044/048/049/050` decodes as TWO
 * real requirements, each cited from both the SRS and discovery
 * namespaces: SRS `FR-043`/discovery `FR-044` = "Record runs off the
 * bat"; SRS `FR-048`/discovery `FR-049`+`FR-050` = "Record boundaries
 * and overthrows" (`FR-048`'s own Trace line: "discovery FR-049, FR-050
 * (consolidated)"). NOT SRS's own separately-numbered `FR-044` ("Record
 * a wide," `UX-13`'s territory) or `FR-049`/`FR-050` ("dismissal
 * mode/detail," `UX-12`'s territory).
 */

export type RunValueResult = { outcome: "valid"; totalRuns: number } | { outcome: "invalid"; reason: string };

/** `UX-11`'s own Validation: "Run value within the primary 0–6 range (higher values composed via the overthrow add-on)." */
export function composeRunValue(primaryTap: number, overthrowAddOn: number): RunValueResult {
  if (!Number.isInteger(primaryTap) || primaryTap < 0 || primaryTap > 6) {
    return { outcome: "invalid", reason: "Primary tap value must be an integer between 0 and 6" };
  }
  if (!Number.isInteger(overthrowAddOn) || overthrowAddOn < 0) {
    return { outcome: "invalid", reason: "Overthrow add-on must be a non-negative integer" };
  }
  return { outcome: "valid", totalRuns: primaryTap + overthrowAddOn };
}

/**
 * `UX-11`'s own Error handling: "only rare, higher-consequence entries
 * (a large overthrow) get a lightweight confirm step." No numeric
 * threshold for "large" is defined anywhere in this corpus (checked
 * `cricket-rules-reference.md` and both spec docs) -- `threshold` is a
 * required caller-supplied parameter, not a hardcoded guess.
 */
export function requiresLightweightConfirm(overthrowAddOn: number, threshold: number): boolean {
  return overthrowAddOn > threshold;
}

export type BallEntryState = "GUARDRAIL_BLOCKED" | "JUST_RECORDED" | "UNDO_AVAILABLE" | "READY";

export interface BallEntryStateInputs {
  isGuardrailModalOpen: boolean;
  justRecorded: boolean;
  undoAvailable: boolean;
}

/**
 * `UX-11`'s own States list ("Ready → just-recorded... → Undo-available
 * · Guardrail-blocked (rare) · Offline (always available)") describes
 * these without an explicit precedence when more than one could apply.
 * This ordering -- guardrail-blocked > just-recorded > undo-available >
 * ready -- is this task's own explicit, flagged interpretation, the
 * same discipline `TASK-0055`'s `deriveScoringState` used. "Offline" is
 * modelled as a separate, orthogonal caller-supplied display flag (same
 * as `TASK-0055`'s `isOnline`), not a member of this state enum.
 */
export function deriveBallEntryState(inputs: BallEntryStateInputs): BallEntryState {
  if (inputs.isGuardrailModalOpen) return "GUARDRAIL_BLOCKED";
  if (inputs.justRecorded) return "JUST_RECORDED";
  if (inputs.undoAvailable) return "UNDO_AVAILABLE";
  return "READY";
}

/** `UX-11`'s own Validation: "submission blocked only while an unrelated guardrail modal is open." */
export function canSubmit(state: BallEntryState): boolean {
  return state !== "GUARDRAIL_BLOCKED";
}
