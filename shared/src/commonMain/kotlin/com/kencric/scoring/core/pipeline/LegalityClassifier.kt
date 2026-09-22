package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.Legality

/**
 * live-scoring.md §6: legality is already scorer-declared (validated,
 * TASK-0017) -- "classification" means deterministically deriving its
 * downstream consequences, nothing more inferred. Pure function of
 * Legality alone; §6.1-6.3 depend on nothing else.
 *
 * Scoped narrowly, not the full C01-C23 case tables: those also cover
 * run totals/extras buckets/strike rotation, which are TASK-0019's
 * (RunEvent/extras decomposition) and TASK-0025's (strike resolution)
 * scope, not this task's. This type carries only what §6 itself defines.
 */
data class LegalityClassification(
    /** §6.1: does this delivery consume a legal-ball slot (LB✓)? */
    val consumesLegalBallSlot: Boolean,
    /** §6.2: does the striker's ballsFaced increment (BF✓)? */
    val incrementsStrikerBallsFaced: Boolean,
    /** §6.3: "identical to §6.1's rule" -- kept as its own named field
     * for call-site clarity, not because the rule differs from
     * consumesLegalBallSlot. */
    val incrementsBowlerLegalBalls: Boolean,
    /** §6.4: DEAD_BALL short-circuits everything -- no RunEvents, no
     * wicket, no ball-count change anywhere, no bowler-figure change.
     * Downstream pipeline stages must check this and skip straight to
     * event emission (§13) when true. */
    val isDeadBallShortCircuit: Boolean,
)

fun classifyLegality(legality: Legality): LegalityClassification = when (legality) {
    Legality.LEGAL -> LegalityClassification(
        consumesLegalBallSlot = true,
        incrementsStrikerBallsFaced = true,
        incrementsBowlerLegalBalls = true,
        isDeadBallShortCircuit = false,
    )
    Legality.WIDE -> LegalityClassification(
        consumesLegalBallSlot = false,
        incrementsStrikerBallsFaced = false,
        incrementsBowlerLegalBalls = false,
        isDeadBallShortCircuit = false,
    )
    Legality.NO_BALL -> LegalityClassification(
        consumesLegalBallSlot = false,
        incrementsStrikerBallsFaced = true,
        incrementsBowlerLegalBalls = false,
        isDeadBallShortCircuit = false,
    )
    Legality.DEAD_BALL -> LegalityClassification(
        consumesLegalBallSlot = false,
        incrementsStrikerBallsFaced = false,
        incrementsBowlerLegalBalls = false,
        isDeadBallShortCircuit = true,
    )
}
