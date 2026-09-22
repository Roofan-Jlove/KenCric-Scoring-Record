package com.kencric.scoring.core.config

/**
 * cricket-rules-reference.md §35 (`CFG-REG`). Scoped to exactly the one
 * key `TASK-0024`'s rules need -- `format.balls_per_over` -- not the
 * full registry (dozens of unrelated keys: DRS, powerplays, DLS, super
 * overs, etc.), which belongs to whichever future task actually
 * consumes them. This is the typed shape `ReferenceDataPort`'s own doc
 * comment (`TASK-0016`) flagged as "not yet modeled."
 */
data class PlayingConditionsProfile(
    val ballsPerOver: Int,
)
