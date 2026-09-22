package com.kencric.scoring.core.model

/**
 * live-scoring.md §13.1-§13.3. `previousOverBowlerId` (§13.1, feeds the
 * `BR-027` "no consecutive overs" guardrail, §4.5) is deliberately NOT a
 * field here -- §4's guardrails are out of scope for every task in this
 * backlog so far (same reasoning `TASK-0017`'s `V10` was skipped). A
 * fresh over's `OverState` (new `overNumber`, `bowlerId`, zeroed
 * counters) is constructed directly by the caller once the next over's
 * bowler is chosen -- this type does not fabricate one.
 */
data class OverState(
    val overNumber: Int,
    val bowlerId: String,
    val legalBallCount: Int = 0,
    val runsThisOver: Int = 0,
    val isMaidenSoFar: Boolean = true,
)
