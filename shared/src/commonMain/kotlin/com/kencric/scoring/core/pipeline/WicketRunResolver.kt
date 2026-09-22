package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.ALWAYS_ZERO_RUNS_MODES
import com.kencric.scoring.core.model.DismissalMode

/**
 * live-scoring.md §9.3: ties the dismissal mode to the already-computed
 * RunAggregate as an explicit, testable Step 5 checkpoint.
 *
 * HONEST SCOPE NOTE: §9.3's own text attributes the always-zero-runs
 * requirement directly to V6 ("batterRuns must be zero and no RunEvent
 * of any origin may be present (V6)") -- that's already enforced as a
 * hard validation-time REJECTION (TASK-0017), not something this
 * function needs to independently force or correct. And for may-carry-
 * runs modes, §9.3 explicitly says runs "count in full, using the
 * normal §7 aggregation and the §8 short-run adjustment" -- meaning
 * TASK-0019/TASK-0020's existing machinery already produces the correct
 * result unchanged, confirmed exactly by live-scoring.md §22.8 EX-09
 * (total=1, ranRuns=1 for a RUN_OUT after one completed run -- precisely
 * what RunAggregator.aggregateRuns already computes given [OB:1:R],
 * no special-casing needed).
 *
 * So this function's real job is narrower than its task title implies:
 * confirm the invariant explicitly (fail loudly if it's ever violated,
 * which would mean V6 was bypassed somewhere upstream) rather than
 * silently "fixing" a wrong input -- and pass may-carry-runs values
 * through completely untouched.
 */
fun assertWicketRunInvariant(mode: DismissalMode, aggregate: RunAggregate) {
    if (mode in ALWAYS_ZERO_RUNS_MODES) {
        check(aggregate.total == 0) {
            "invariant violated: $mode must have zero total runs (§9.3) but got ${aggregate.total} " +
                "-- V6 should have already rejected this at validation; this indicates V6 was bypassed"
        }
    }
    // May-carry-runs modes (RUN_OUT, HIT_WICKET, OBSTRUCTING_THE_FIELD):
    // no check, no adjustment -- the aggregate is used exactly as
    // TASK-0019/TASK-0020 already computed it, per §9.3's own instruction
    // to use "the normal §7 aggregation and the §8 short-run adjustment."
}
