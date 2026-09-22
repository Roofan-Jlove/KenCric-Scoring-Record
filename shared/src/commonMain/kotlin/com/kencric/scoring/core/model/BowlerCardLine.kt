package com.kencric.scoring.core.model

/**
 * live-scoring.md §11. `maidens` is declared here (matching §11's table)
 * but is evaluated only at over completion (§13.3) -- a per-over
 * checkpoint outside this task's per-delivery scope, so it is never
 * touched by this task's update function; a later over-completion task
 * owns it.
 */
data class BowlerCardLine(
    val playerId: String,
    val legalBallsBowled: Int = 0,
    val runsCharged: Int = 0,
    val wickets: Int = 0,
    val widesBowled: Int = 0,
    val noBallsBowled: Int = 0,
    val maidens: Int = 0,
)
