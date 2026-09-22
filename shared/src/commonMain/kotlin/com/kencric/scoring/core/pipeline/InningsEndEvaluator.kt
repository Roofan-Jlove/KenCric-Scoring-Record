package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.InningsEndReason

/**
 * live-scoring.md §15 (Step 11), `SVC-INNINGS-END-EVALUATOR`. Evaluated
 * after Steps 5-10 (wicket resolution through strike resolution) are
 * fully applied for a delivery -- fixed priority order, first condition
 * met wins, matching §15's own numbered list exactly (1: all-out,
 * 2: overs-complete, 3: target-reached). §15.4 (declaration/forfeiture)
 * is a captain-initiated event, not delivery-triggered -- explicitly out
 * of §15's own scope, so it is not evaluated here.
 *
 * Takes plain primitives rather than a full `InningsState` aggregate --
 * consistent with every other evaluator in this pipeline (e.g.
 * `LegalityClassifier` takes a bare `Legality`, not a whole
 * `DeliveryInput`). HONEST GAP: a full `InningsState` type matching
 * §2's complete shape (`inningsId`, `battingTeamId`, `bowlingTeamId`,
 * `target`, `freeHitPending`, `strikerBatterId`, `nonStrikerBatterId`,
 * `currentBowlerId`, `previousOverBowlerId`) does not exist anywhere in
 * this backlog yet -- `InningsScoreState` (`TASK-0024`) only carries
 * the score-aggregate subset §12 needed. Assembling the full aggregate
 * is orchestration-layer work, not this pure evaluator's job.
 *
 * `retiredNotOutOrAbsentCount` is the caller-supplied count of batters
 * currently `RETIRED_NOT_OUT` or `ABSENT` (`MINV-10`) -- verified
 * against `§22.8`'s `EX-11`, which states this reduces the effective
 * all-out threshold by 1 for the rest of the innings while the batter
 * remains `RETIRED_NOT_OUT`.
 */
fun evaluateInningsEnd(
    wicketsLost: Int,
    maxWicketsPerInnings: Int,
    retiredNotOutOrAbsentCount: Int,
    legalBallsBowled: Int,
    oversAllotted: Int,
    ballsPerOver: Int,
    totalRuns: Int,
    target: Int?,
): InningsEndReason? {
    val effectiveAllOutThreshold = maxWicketsPerInnings - retiredNotOutOrAbsentCount
    if (wicketsLost >= effectiveAllOutThreshold) return InningsEndReason.ALL_OUT
    if (legalBallsBowled == oversAllotted * ballsPerOver) return InningsEndReason.OVERS_COMPLETE
    if (target != null && totalRuns >= target) return InningsEndReason.TARGET_REACHED
    return null
}
