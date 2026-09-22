package com.kencric.scoring.core.config

/**
 * cricket-rules-reference.md §35 (`CFG-REG`). Scoped to exactly the keys
 * actually consumed by tasks so far -- `format.balls_per_over`
 * (`TASK-0024`) and `free_hit_enabled` (`TASK-0029`, needed to fold
 * `§13.4`'s free-hit persistence during an innings refold) -- not the
 * full registry (dozens of unrelated keys: DRS, powerplays, DLS, super
 * overs, etc.), which belongs to whichever future task actually
 * consumes them. This is the typed shape `ReferenceDataPort`'s own doc
 * comment (`TASK-0016`) flagged as "not yet modeled." Widened
 * incrementally as real consumers appear, not rebuilt from scratch.
 */
data class PlayingConditionsProfile(
    val ballsPerOver: Int,
    /** cricket-rules-reference.md §35's `free_hit_enabled` key. Named
     * to match live-scoring.md §13.4's own field name
     * (`freeHitOnNoBall`), not the CFG-REG key's own spelling. */
    val freeHitOnNoBall: Boolean = false,
)
