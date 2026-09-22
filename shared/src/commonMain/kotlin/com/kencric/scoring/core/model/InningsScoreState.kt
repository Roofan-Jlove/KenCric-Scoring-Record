package com.kencric.scoring.core.model

/**
 * live-scoring.md §12. Named fields (not an `ExtrasCategory`-keyed map,
 * unlike `RunAggregate.extras`) matching §12's own table exactly
 * (`extras.{byes, legByes, wides, noBalls, penalty}`), and to avoid
 * `model/` depending on `pipeline/`'s `ExtrasCategory` enum.
 *
 * `INV-001` (total identity, §12's own closing note): `totalRuns` must
 * always equal the sum of every batter's `runs` plus these five extras
 * fields -- true by construction from how `updateInningsScoreState`
 * computes each field from the same `RunAggregate`, not separately
 * re-verified here.
 */
data class InningsScoreState(
    val totalRuns: Int = 0,
    val byes: Int = 0,
    val legByes: Int = 0,
    val wides: Int = 0,
    val noBalls: Int = 0,
    val penalty: Int = 0,
    val wicketsLost: Int = 0,
    val legalBallsBowled: Int = 0,
)
