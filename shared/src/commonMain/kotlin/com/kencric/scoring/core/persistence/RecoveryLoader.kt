package com.kencric.scoring.core.persistence

import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.pipeline.foldInnings
import com.kencric.scoring.core.ports.EventLogPort

/**
 * offline-first-specification.md §3.4 (Recovery on load), restated
 * "precisely from live-scoring.md §18.1... as the canonical local-
 * persistence contract": on every app start, current state is always
 * obtained by folding the active portion of the local event log from
 * the beginning, never by trusting a cached snapshot as authoritative.
 *
 * Composes `EventLogPort.readAll()` (`TASK-0016`) with `TASK-0029`'s
 * `foldInnings()` -- the exact same fold mechanism §18.1/§19.1 already
 * use, per §3.4's own explicit cross-reference; no new fold logic here.
 *
 * [deserialize] is caller-supplied rather than a real JSON parse --
 * the same gap `FixtureSchema.kt` (`TASK-0032`) already flagged: no
 * `kotlinx-serialization-json` dependency exists, no Gradle build
 * exists for `shared/` at all. Once a real deserializer exists, this
 * function needs no changes -- it is already correct against whatever
 * `deserialize` a real platform adapter eventually supplies.
 */
suspend fun recoverInningsState(
    eventLog: EventLogPort,
    initialState: InningsFoldState,
    config: FoldConfig,
    deserialize: (String) -> DeliveryInput,
): InningsFoldState {
    val deliveries = eventLog.readAll().map(deserialize)
    return foldInnings(initialState, deliveries, config)
}
