package com.kencric.scoring.core.sync

/**
 * offline-first-specification.md §3.2/§7.3, data-specification.md
 * §9.1's `sync_cursors` table (`direction = PULL`). Device-local only
 * -- `§9.1`'s own "Sync model" note: "never itself synchronized to the
 * server as domain data." One cursor per remote stream this device
 * reads.
 *
 * `lastPulledEventOrdinal` is a `Double` here, not the SQL column's
 * exact `numeric(20,10)` -- the same flagged simplification `TASK-0028`
 * already made for `AuditedEvent.eventOrdinal` (kept as a plain
 * `String` there, no arbitrary-precision decimal type exists in this
 * backlog). A `Double` is sufficient for the ordering/monotonicity
 * logic this task's own scope needs; exact decimal fidelity at
 * production scale is a real gap for whenever a numeric type is
 * actually chosen.
 */
data class PullCursor(val streamId: String, val lastPulledEventOrdinal: Double? = null)

/**
 * offline-first-specification.md §3.2: "Advances monotonically; never
 * rewound except by the recovery procedures in §15." Never regresses,
 * even if called with a smaller/equal ordinal than already recorded.
 */
fun advancePullCursor(cursor: PullCursor, seenEventOrdinal: Double): PullCursor {
    val current = cursor.lastPulledEventOrdinal
    return if (current == null || seenEventOrdinal > current) {
        cursor.copy(lastPulledEventOrdinal = seenEventOrdinal)
    } else {
        cursor
    }
}
