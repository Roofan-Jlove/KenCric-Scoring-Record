package com.kencric.scoring.core.model

/**
 * live-scoring.md §3: every delivery -- legal, wide, no-ball, or dead
 * ball, with or without a wicket -- is captured through this one shape.
 * Legality and run classification are always an explicit scorer
 * declaration; the engine never infers them.
 */
data class DeliveryInput(
    val legality: Legality,
    val strikerBatterId: String,
    val nonStrikerBatterId: String,
    val bowlerId: String,
    val isFreeHit: Boolean,
    val runEvents: List<RunEvent> = emptyList(),
    val shortRuns: Int = 0,
    val wicket: WicketDetail? = null,
    /** Required (non-blank) iff legality == DEAD_BALL (§3, V11). */
    val deadBallReason: String? = null,
    val commentary: String? = null,
    /** Required (non-blank) iff a guardrail override is in effect (§3,
     * V10). This task does not implement §4's guardrail-precondition
     * stage that would set that flag -- see DeliveryValidator.kt's V10
     * note for the resulting scope reduction. */
    val overrideReason: String? = null,
)

/**
 * The minimal external state V8 needs (which batters may legally be the
 * incoming batter) -- deliberately NOT the full §2 pre-state model
 * (ConditionsProfile/OverState/BowlerCardLine/etc.), none of which any
 * other V1-V11 rule touches. Building the full pre-state ahead of the
 * tasks that actually need it (E-11 onward) would be scope creep beyond
 * what this task's own acceptance criteria (§21.9) requires.
 */
data class BattingContext(
    val battingXiPlayerIds: Set<String>,
    val alreadyBattedPlayerIds: Set<String>,
    val notOutPlayerIds: Set<String>,
)
