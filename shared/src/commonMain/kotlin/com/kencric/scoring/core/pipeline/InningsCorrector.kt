package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.BattingContext
import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.model.ValidationFailure
import com.kencric.scoring.core.model.ValidationResult

/**
 * live-scoring.md §19 (Correction). Reuses `TASK-0029`'s `applyDelivery`
 * entirely -- §19.1 step 4 is explicit that recomputation is "identical
 * mechanism to §18.1 step 3" -- the only genuinely new content this task
 * adds is (a) re-validating the corrected payload before accepting it
 * (§19.1 step 2, never re-run by Undo's fold) and (b) §19.2's
 * innings-end-timing edge-case detection plus the §19.1 step 5 cascade
 * summary, neither of which `TASK-0029` needed.
 */

/** One fold step's worth of state, paired with how many deliveries had actually been consumed when it was produced -- see [foldInningsToEnd]. */
data class BoundedFoldResult(val state: InningsFoldState, val consumedDeliveryCount: Int)

/**
 * Like `foldInnings`, but stops as soon as the innings ends rather than
 * continuing to no-op through the rest of [deliveries] -- needed to
 * detect §19.2's "N later deliveries are now outside the innings"
 * sub-case, which requires knowing exactly *where* the innings ended,
 * not just its final state.
 */
fun foldInningsToEnd(initialState: InningsFoldState, deliveries: List<DeliveryInput>, config: FoldConfig): BoundedFoldResult {
    var state = initialState
    for ((index, delivery) in deliveries.withIndex()) {
        if (state.inningsEndReason != null) return BoundedFoldResult(state, index)
        state = applyDelivery(state, delivery, config)
    }
    return BoundedFoldResult(state, deliveries.size)
}

/** The full step-by-step fold trace, one [InningsFoldState] per delivery folded (index i = state after deliveries[i]). */
fun foldTrace(initialState: InningsFoldState, deliveries: List<DeliveryInput>, config: FoldConfig): List<InningsFoldState> {
    val trace = mutableListOf<InningsFoldState>()
    var state = initialState
    for (delivery in deliveries) {
        state = applyDelivery(state, delivery, config)
        trace.add(state)
    }
    return trace
}

/**
 * §19.1 step 5: "whether strike-continuity was broken anywhere in the
 * replay." Returns the first delivery index (0-based, into the shorter
 * of the two traces) where the striker/non-striker pairing diverges
 * between the pre- and post-correction folds, or null if it never does.
 */
fun firstStrikeContinuityBreak(originalTrace: List<InningsFoldState>, correctedTrace: List<InningsFoldState>): Int? {
    val length = minOf(originalTrace.size, correctedTrace.size)
    for (i in 0 until length) {
        val before = originalTrace[i]
        val after = correctedTrace[i]
        if (before.strikerBatterId != after.strikerBatterId || before.nonStrikerBatterId != after.nonStrikerBatterId) {
            return i
        }
    }
    return null
}

/** §19.2's two flagged, non-auto-resolved sub-cases. Never both true at once -- they describe opposite directions of change. */
data class InningsEndTimingChange(
    /** Sub-case 1: the corrected fold ends before consuming the whole corrected delivery list -- this many trailing deliveries are now outside the active innings boundary, orphaned but never discarded (§19.2). */
    val orphanedDeliveryCount: Int? = null,
    /** Sub-case 2: the original fold had ended, but the corrected fold consumes every corrected delivery without ever reaching an end condition -- "correction requires continuation" (§19.2). */
    val requiresContinuation: Boolean = false,
)

/** §19.1 step 5's cascade summary, shown to the scorer before the correction is finalised. */
data class CascadeSummary(
    val endTimingChange: InningsEndTimingChange,
    val firstStrikeContinuityBreakIndex: Int?,
)

sealed class CorrectionOutcome {
    /** §19.1 step 2: the corrected payload failed the same validation fresh entry would have. Never applied. */
    data class Rejected(val failures: List<ValidationFailure>) : CorrectionOutcome()
    data class Applied(
        val correctedDeliveries: List<DeliveryInput>,
        val newState: InningsFoldState,
        val cascadeSummary: CascadeSummary,
    ) : CorrectionOutcome()
}

/**
 * §19.1: correct the delivery at [correctionIndex] (any prior active
 * event, not only the most recent -- unlike Undo) to [correctedDelivery],
 * and refold. [battingContext] revalidates the corrected payload exactly
 * as fresh entry would (§19.1 step 2) -- a correction cannot introduce a
 * state fresh entry would have rejected.
 *
 * HONEST SCOPE NOTE: does not itself emit `EVT-DELIVERY-CORRECTED`
 * (`TASK-0027`'s event-schema scope, not modeled by this task) or
 * enforce §19.3's post-Final elevated-role precondition (orchestration/
 * authz concern, not this pure fold function's job) -- this function is
 * the deterministic supersede-and-refold computation §19.1 steps 2-5
 * actually specify, which those concerns wrap around.
 */
fun correctDelivery(
    genesis: InningsFoldState,
    activeDeliveries: List<DeliveryInput>,
    correctionIndex: Int,
    correctedDelivery: DeliveryInput,
    battingContext: BattingContext,
    config: FoldConfig,
): CorrectionOutcome {
    val validation = validateDelivery(correctedDelivery, battingContext)
    if (validation is ValidationResult.Invalid) {
        return CorrectionOutcome.Rejected(validation.failures)
    }

    val correctedDeliveries = activeDeliveries.toMutableList().also { it[correctionIndex] = correctedDelivery }

    val originalTrace = foldTrace(genesis, activeDeliveries, config)
    val correctedTrace = foldTrace(genesis, correctedDeliveries, config)
    val strikeBreakIndex = firstStrikeContinuityBreak(originalTrace, correctedTrace)

    val correctedBounded = foldInningsToEnd(genesis, correctedDeliveries, config)
    val endedEarlier = if (correctedBounded.state.inningsEndReason != null && correctedBounded.consumedDeliveryCount < correctedDeliveries.size) {
        correctedDeliveries.size - correctedBounded.consumedDeliveryCount
    } else {
        null
    }

    val originalEnded = originalTrace.lastOrNull()?.inningsEndReason != null
    val correctedNeverEnded = correctedBounded.state.inningsEndReason == null && correctedBounded.consumedDeliveryCount == correctedDeliveries.size
    val requiresContinuation = originalEnded && correctedNeverEnded

    return CorrectionOutcome.Applied(
        correctedDeliveries = correctedDeliveries,
        newState = correctedBounded.state,
        cascadeSummary = CascadeSummary(
            endTimingChange = InningsEndTimingChange(orphanedDeliveryCount = endedEarlier, requiresContinuation = requiresContinuation),
            firstStrikeContinuityBreakIndex = strikeBreakIndex,
        ),
    )
}
