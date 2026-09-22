package com.kencric.scoring.core.pipeline

/**
 * live-scoring.md §14.2 (Step 10), `SVC-STRIKE-RESOLVER`'s single formula.
 *
 * `effectiveRanRuns` must be read off a `RunAggregate` computed from the
 * §8-adjusted `RunEvent` list (`TASK-0020`'s `applyShortRuns()` output),
 * never the raw one -- the same "adjusted list in" contract
 * `TASK-0022`'s wicket-run checkpoint already relies on; §14.2 states
 * this explicitly ("effectiveRanRuns is the §8-adjusted value").
 *
 * `isOverFinalLegalBall` is exactly `TASK-0024`'s
 * `OverUpdateResult.isOverComplete` for this same delivery -- §14.2's
 * own definition ("legality consumes a slot AND doing so brings
 * legalBallCount to ballsPerOver") is identical to how `isOverComplete`
 * is already computed there, so this function takes it as a
 * precomputed Boolean rather than re-deriving over-completion from
 * scratch. A `WIDE`/`NO_BALL`/`DEAD_BALL` is never "the over's final
 * ball" by this definition, which falls out automatically: those never
 * consume a slot, so `isOverComplete` is always `false` for them.
 *
 * HONEST SCOPE NOTE: §14.3 (wicket interaction), §14.5 (manual
 * override), and §14.6 (mankad, which skips this formula entirely) are
 * orchestration-level rules about *when*/*whether* to call this
 * function and how to combine its result with `TASK-0043`'s
 * `resolveEndPositions()` -- not additional computation this formula
 * itself needs. Not implemented here; this function is exactly and
 * only §14.2's formula, per the task's own title.
 */
fun resolvesStrikeRotation(effectiveRanRuns: Int, isOverFinalLegalBall: Boolean): Boolean =
    (effectiveRanRuns % 2 == 1) xor isOverFinalLegalBall

/** §14.2: "the striker and non-striker identifiers swap for the next delivery." */
data class StrikePositions(val strikerBatterId: String, val nonStrikerBatterId: String)

fun applyStrikeRotation(current: StrikePositions, netRotates: Boolean): StrikePositions =
    if (netRotates) StrikePositions(current.nonStrikerBatterId, current.strikerBatterId) else current
