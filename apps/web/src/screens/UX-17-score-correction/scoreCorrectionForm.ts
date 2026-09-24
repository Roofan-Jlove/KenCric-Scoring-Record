/**
 * TASK-0069: `ux-specification.md UX-17` -- Score Correction, reason-
 * gate/elevated-role layer.
 *
 * `shared/`'s existing `InningsCorrector.kt` (`TASK-0029`) already
 * implements `live-scoring.md §19.1`'s correction/refold/cascade-
 * summary logic in full (`correctDelivery()`), but its own "HONEST
 * SCOPE NOTE" explicitly excludes `§19.3`'s post-Final elevated-role
 * precondition and `EVT-DELIVERY-CORRECTED` emission, calling both
 * "orchestration/authz concerns." This module is exactly that wrapper --
 * the cascade computation itself is consumed here as a caller-supplied
 * `CascadeSummary`, not reimplemented in TypeScript.
 *
 * CITATION NOTE: `BR-004`/`BR-006` match exactly across both the
 * discovery and SRS namespaces (no collision this time, unlike the
 * higher-numbered `BR-027…036` collisions `TASK-0059`/`0061`/`0065`
 * found). `FR-097…103/108` are SRS-level and correctly this screen's
 * own territory.
 */

export interface CascadeSummary {
  orphanedDeliveryCount: number | null;
  requiresContinuation: boolean;
  firstStrikeContinuityBreakIndex: number | null;
}

export interface CorrectionFormState {
  reason: string;
  isFinal: boolean;
  hasElevatedRole: boolean;
}

export type ConfirmResult = { outcome: "allowed" } | { outcome: "blocked"; reason: string };

/**
 * `AUD-005`: "A reason is required for every correction." `BR-006`/
 * `§19.3`: a post-Final correction additionally requires an elevated
 * role. The two failure modes are never conflated into one generic
 * error -- `UX-17`'s own Error-handling text: "states exactly what's
 * required."
 */
export function canConfirmCorrection(state: CorrectionFormState): ConfirmResult {
  if (state.reason.trim() === "") {
    return { outcome: "blocked", reason: "A reason is required for every correction" };
  }
  if (state.isFinal && !state.hasElevatedRole) {
    return { outcome: "blocked", reason: "Corrections to a Final match require an elevated role" };
  }
  return { outcome: "allowed" };
}

/** `UX-17`'s own Accessibility text: "the cascade summary is presented as structured, readable text, not a visual-only diff." */
export function describeCascade(summary: CascadeSummary): string[] {
  const lines: string[] = [];
  if (summary.firstStrikeContinuityBreakIndex !== null) {
    lines.push(`Strike continuity breaks at delivery ${summary.firstStrikeContinuityBreakIndex + 1}`);
  }
  if (summary.orphanedDeliveryCount !== null) {
    lines.push(`${summary.orphanedDeliveryCount} later deliveries are now outside the innings`);
  }
  if (summary.requiresContinuation) {
    lines.push("The innings no longer ends here -- further deliveries are required");
  }
  if (lines.length === 0) {
    lines.push("No downstream changes detected");
  }
  return lines;
}
