package com.kencric.scoring.ui.screens.ux17scorecorrection

import com.kencric.scoring.core.pipeline.CascadeSummary

/**
 * TASK-0070: `ux-specification.md UX-17`'s own screen logic. Unlike the
 * web TS mirror (`TASK-0069`, which necessarily redefines a
 * `CascadeSummary` shape since TypeScript cannot import Kotlin types),
 * this file **imports the real `core.pipeline.CascadeSummary`** directly
 * -- genuine Kotlin reuse across the same `shared/commonMain` source
 * set, the same pattern `TASK-0060` established for `DismissalMode`.
 *
 * `shared/`'s existing `InningsCorrector.kt` (`TASK-0029`) already
 * implements `§19.1`'s correction/refold/cascade-summary logic in full;
 * its own "HONEST SCOPE NOTE" excludes `§19.3`'s post-Final elevated-
 * role precondition and event emission -- this module is exactly that
 * wrapper. See `TASK-0069`'s own file for the full citation note.
 */

data class CorrectionFormState(
    val reason: String,
    val isFinal: Boolean,
    val hasElevatedRole: Boolean,
)

sealed class ConfirmResult {
    object Allowed : ConfirmResult()
    data class Blocked(val reason: String) : ConfirmResult()
}

/**
 * `AUD-005`: "A reason is required for every correction." `BR-006`/
 * `§19.3`: a post-Final correction additionally requires an elevated
 * role. The two failure modes are never conflated -- `UX-17`'s own
 * Error-handling text: "states exactly what's required."
 */
fun canConfirmCorrection(state: CorrectionFormState): ConfirmResult {
    if (state.reason.trim().isEmpty()) {
        return ConfirmResult.Blocked("A reason is required for every correction")
    }
    if (state.isFinal && !state.hasElevatedRole) {
        return ConfirmResult.Blocked("Corrections to a Final match require an elevated role")
    }
    return ConfirmResult.Allowed
}

/** UX-17's own Accessibility text: "the cascade summary is presented as structured, readable text, not a visual-only diff." */
fun describeCascade(summary: CascadeSummary): List<String> {
    val lines = mutableListOf<String>()
    val breakIndex = summary.firstStrikeContinuityBreakIndex
    if (breakIndex != null) {
        lines.add("Strike continuity breaks at delivery ${breakIndex + 1}")
    }
    val orphanedCount = summary.endTimingChange.orphanedDeliveryCount
    if (orphanedCount != null) {
        lines.add("$orphanedCount later deliveries are now outside the innings")
    }
    if (summary.endTimingChange.requiresContinuation) {
        lines.add("The innings no longer ends here -- further deliveries are required")
    }
    if (lines.isEmpty()) {
        lines.add("No downstream changes detected")
    }
    return lines
}
