package com.kencric.scoring.core.conformance

import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.pipeline.applyDelivery

/**
 * testing-strategy.md §4.1: the conformance suite's shape for the "fixed
 * case catalogue" and "worked-example replay" techniques. A case is one
 * delivery applied to a known pre-state, with a known expected
 * post-state -- exercising `live-scoring.md §5-§15`'s pipeline
 * end-to-end (via `TASK-0029`'s `applyDelivery`, the one function that
 * already composes every pipeline stage this suite needs to check),
 * "a fully-computed output across every dimension... out," per §4.1's
 * own framing.
 *
 * `id` matches the source catalogue's own naming (`C01`...`C55`,
 * `EX-01`...`EX-13`) so a failing case is traceable directly back to
 * `live-scoring.md §21`/`§22` -- never re-derived or renumbered.
 *
 * SCOPE NOTE for `TASK-0032` (which loads the full `C01-C55`/`EX-01-13`
 * corpus): full `InningsFoldState` equality is the simplest possible
 * comparison and is exactly right for the `EX-*` worked examples (which
 * are themselves full end-to-end replays), but some `C*` cases are
 * narrower (e.g. only a legality-classification column, no full innings
 * context at all) and may not fit this shape without adaptation -- left
 * for that task to resolve, not pre-solved here speculatively.
 */
data class ConformanceCase(
    val id: String,
    val description: String,
    val genesis: InningsFoldState,
    val config: FoldConfig,
    val delivery: DeliveryInput,
    val expected: InningsFoldState,
)

data class ConformanceCaseResult(
    val case: ConformanceCase,
    val actual: InningsFoldState,
    val passed: Boolean,
)

/** Runs one case through the pipeline and compares actual vs. expected. */
fun runConformanceCase(case: ConformanceCase): ConformanceCaseResult {
    val actual = applyDelivery(case.genesis, case.delivery, case.config)
    return ConformanceCaseResult(case, actual, passed = actual == case.expected)
}

/**
 * testing-strategy.md §4.3: "100% required to release -- not a target,
 * a hard release gate." Every case is run (not short-circuited on first
 * failure) so a single suite execution reports every failing case at
 * once, matching that gate's own "the same runner and fixture set
 * produce identical pass/fail results" framing -- one result per case,
 * not one boolean for the whole run.
 */
fun runConformanceSuite(cases: List<ConformanceCase>): List<ConformanceCaseResult> =
    cases.map { runConformanceCase(it) }
