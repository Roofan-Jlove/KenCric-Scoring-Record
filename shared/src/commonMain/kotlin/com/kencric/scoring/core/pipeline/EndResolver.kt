package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.CreaseEnd
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.opposite

/** live-scoring.md §9.5: which end the incoming batter occupies, and
 * which end the surviving batter ends up at. */
data class EndResolution(val newBatterEnd: CreaseEnd, val survivingBatterEnd: CreaseEnd)

/**
 * §9.5's three rules, transcribed precisely rather than re-derived from
 * first principles -- cricket's crease-swap-on-a-completed-run behavior
 * is genuinely easy to get subtly wrong, so each branch is grounded
 * directly in the spec's own wording, cross-checked against standard
 * "batters swap ends on every completed run" domain knowledge before
 * being written (documented per-branch below), not assumed correct by
 * construction.
 *
 * dismissedBatterOriginalEnd: which end the OUT batter occupied at the
 * START of this delivery (before any running) -- derived by the caller
 * from wicket.outBatterId vs. the pre-delivery strikerBatterId/
 * nonStrikerBatterId, not re-derived by this function.
 *
 * endVacated: the scorer-declared WicketDetail.endVacated (§9.2) --
 * trusted directly for the non-RUN_OUT and not-crossed RUN_OUT cases
 * (rule 1, rule 2a's own "i.e. endVacated as declared" phrasing), NOT
 * independently re-derived for those branches. Only the crossed=true
 * branch computes its own value, per rule 2b's explicit alternate
 * formula -- see that branch's comment for why.
 */
fun resolveEndPositions(
    mode: DismissalMode,
    dismissedBatterOriginalEnd: CreaseEnd,
    endVacated: CreaseEnd,
    crossedBeforeDismissal: Boolean? = null,
): EndResolution {
    val survivorOriginalEnd = dismissedBatterOriginalEnd.opposite()

    return when {
        // Rule 1: non-RUN_OUT. New batter takes exactly the declared
        // endVacated (the exact end the dismissed batter left); survivor
        // is trivially at the other end (only two ends exist).
        mode != DismissalMode.RUN_OUT -> EndResolution(
            newBatterEnd = endVacated,
            survivingBatterEnd = survivorOriginalEnd,
        )

        // Rule 2b: RUN_OUT, crossed. The batters had already physically
        // swapped ends (as any completed run does) before the dismissal
        // completed. The survivor keeps that swap -- they now occupy the
        // dismissed batter's ORIGINAL end. The new batter takes the end
        // the dismissed batter would have reached, which -- because
        // running always swaps ends -- is the survivor's original end.
        // This is why the two output values are exactly each other's
        // original positions, a clean symmetric swap, matching "the
        // surviving batter has swapped ends with the dismissed batter"
        // literally.
        crossedBeforeDismissal == true -> EndResolution(
            newBatterEnd = survivorOriginalEnd,
            survivingBatterEnd = dismissedBatterOriginalEnd,
        )

        // Rule 2a: RUN_OUT, not crossed (the default when
        // crossedBeforeDismissal is false or, defensively, null -- a
        // RUN_OUT with a null crossedBeforeDismissal is itself invalid
        // input, a V-rule concern this function doesn't re-validate).
        // The run was never completed, so no swap occurred: survivor
        // stays at their original end; new batter takes the declared
        // endVacated (trusted directly, per rule 2a's own wording).
        else -> EndResolution(
            newBatterEnd = endVacated,
            survivingBatterEnd = survivorOriginalEnd,
        )
    }
}
