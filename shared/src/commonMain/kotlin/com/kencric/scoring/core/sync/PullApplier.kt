package com.kencric.scoring.core.sync

/** One event as returned by a pull response -- enough to advance the cursor and check idempotency; the full domain payload is a separate concern (deserialization, same flagged gap as `TASK-0032`/`TASK-0033`). */
data class PulledRemoteEvent(val eventId: String, val eventOrdinal: Double)

data class PullApplyResult(
    val newCursor: PullCursor,
    /** New event ids this device had not seen before -- these are the ones that need folding into local projections. */
    val newlyAppliedEventIds: List<String>,
    /** Already-seen event ids in this pull response -- §9.4's idempotent no-op case (a resumed cursor or a retried pull request). */
    val skippedAsAlreadyApplied: List<String>,
)

/**
 * offline-first-specification.md §7.3 step 4: "applies each pulled
 * event to its local mirror... idempotently (§9.4 -- re-applying an
 * already-applied event_id is a no-op), advances its cursor only past
 * what it has durably stored locally, and only then refolds affected
 * projections."
 *
 * The cursor advances past EVERY event in the response, whether newly
 * applied or an already-seen duplicate -- both cases have now been
 * durably stored/recognized locally, which is what §3.2's own
 * "advances monotonically" clause tracks; skipping the cursor advance
 * for duplicates would make the same duplicate get re-pulled forever.
 * `[PulledRemoteEvent]`s are assumed pre-sorted by `eventOrdinal`
 * ascending (`§7.3` step 3, the server's own responsibility -- see
 * `backend/src/sync/pullEvents.ts`'s `eventsAfter`).
 */
fun applyPulledEvents(
    cursor: PullCursor,
    pulledEvents: List<PulledRemoteEvent>,
    alreadyAppliedEventIds: Set<String>,
): PullApplyResult {
    var newCursor = cursor
    val newlyApplied = mutableListOf<String>()
    val skipped = mutableListOf<String>()

    for (event in pulledEvents) {
        if (event.eventId in alreadyAppliedEventIds) {
            skipped.add(event.eventId)
        } else {
            newlyApplied.add(event.eventId)
        }
        newCursor = advancePullCursor(newCursor, event.eventOrdinal)
    }

    return PullApplyResult(newCursor, newlyApplied, skipped)
}
