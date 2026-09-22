package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod

/**
 * live-scoring.md §8: shortRuns states how many attempted running-runs
 * are disallowed for failing to ground bat/person. Deduction rule
 * [LAW]: disallowed run(s) are always taken from the END of the
 * sequence -- batters keep credit for every run completed before the
 * short one.
 *
 * CORRECTION vs. this task's own backlog entry, made deliberately, not
 * silently: implementation-task-backlog.md TASK-0020's Expected behavior
 * field says a short run reduces ranRuns "without affecting
 * batterRuns/extras attribution rules elsewhere in §7." §8's actual text
 * says the opposite, explicitly: "this adjusted value -- not the raw
 * ranRuns -- is what flows into batterRuns, bowlerRunsCharged, extras
 * totals, and the strike-rotation calculation," with a worked example
 * confirming a RunEvent(value=2) with shortRuns=1 credits 1, not 2,
 * "across every downstream total." Implemented per the actual spec
 * text (authoritative over the backlog's paraphrase of it), not the
 * backlog's summary.
 *
 * Returns an adjusted RunEvent list with shortRuns removed from the
 * tail-most RUN-method events; every other event (BOUNDARY/OVERTHROW/
 * AUTOMATIC-method, any non-RUN origin) is untouched. Callers pass the
 * RESULT of this function to RunAggregator.aggregateRuns, never the raw
 * list, whenever shortRuns > 0 -- this is a pre-processing step, not an
 * alternative to that aggregator.
 */
fun applyShortRuns(runEvents: List<RunEvent>, shortRuns: Int): List<RunEvent> {
    if (shortRuns <= 0) return runEvents

    var remaining = shortRuns
    val adjusted = runEvents.toMutableList()

    for (i in adjusted.indices.reversed()) {
        if (remaining <= 0) break
        val event = adjusted[i]
        if (event.method != RunEventMethod.RUN) continue
        val deduction = minOf(event.value, remaining)
        if (deduction > 0) {
            adjusted[i] = event.copy(value = event.value - deduction)
            remaining -= deduction
        }
    }

    // V3 (TASK-0017) already guarantees shortRuns <= the RUN-method total
    // before this function is ever called, so `remaining` reaching 0 is
    // expected, not merely hoped for -- not re-validated here, since
    // re-validating an already-validated input is a different task's
    // concern (defense-in-depth at the API boundary, not this pipeline
    // stage).

    return adjusted
}
