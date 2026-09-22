package com.kencric.scoring.core.model

/** live-scoring.md §2 (pre-state), status values per §21.7/data-specification.md §7.7. */
enum class BatterStatus { NOT_OUT, OUT, RETIRED_NOT_OUT, RETIRED_OUT, ABSENT }

/**
 * live-scoring.md §10. `status`/`dismissal` are declared here (matching
 * §2's pre-state table) but NOT updated by this task's functions --
 * setting them correctly requires the full wicket-detection/who-was-
 * dismissed orchestration, which doesn't exist as a single pipeline
 * step yet. This task's scope is the numeric figures §10's table
 * actually walks through (runs/ballsFaced/fours/sixes); status
 * transitions are a deferred, separate concern, not silently assumed
 * solved here.
 */
data class BatterCardLine(
    val playerId: String,
    val runs: Int = 0,
    val ballsFaced: Int = 0,
    val fours: Int = 0,
    val sixes: Int = 0,
    val status: BatterStatus = BatterStatus.NOT_OUT,
)
