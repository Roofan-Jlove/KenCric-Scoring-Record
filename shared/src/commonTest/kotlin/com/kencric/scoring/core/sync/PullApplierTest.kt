package com.kencric.scoring.core.sync

import kotlin.test.Test
import kotlin.test.assertEquals

class PullCursorTest {

    @Test fun a_fresh_cursor_adopts_the_first_seen_ordinal() {
        val cursor = advancePullCursor(PullCursor("stream-1"), 1.0)
        assertEquals(1.0, cursor.lastPulledEventOrdinal)
    }

    @Test fun the_cursor_advances_forward() {
        val cursor = advancePullCursor(PullCursor("stream-1", 1.0), 2.0)
        assertEquals(2.0, cursor.lastPulledEventOrdinal)
    }

    // §3.2: "advances monotonically; never rewound."
    @Test fun the_cursor_never_rewinds() {
        val cursor = advancePullCursor(PullCursor("stream-1", 5.0), 2.0)
        assertEquals(5.0, cursor.lastPulledEventOrdinal, "a smaller ordinal must never move the cursor backward")
    }

    @Test fun an_equal_ordinal_does_not_move_the_cursor() {
        val cursor = advancePullCursor(PullCursor("stream-1", 3.0), 3.0)
        assertEquals(3.0, cursor.lastPulledEventOrdinal)
    }
}

class PullApplierTest {

    // §7.3 step 4, the basic case: a fresh batch of never-before-seen
    // events all get newly applied and the cursor advances to the last one.
    @Test fun a_fresh_batch_is_entirely_newly_applied() {
        val events = listOf(
            PulledRemoteEvent("e1", 1.0),
            PulledRemoteEvent("e2", 2.0),
            PulledRemoteEvent("e3", 3.0),
        )
        val result = applyPulledEvents(PullCursor("stream-1"), events, alreadyAppliedEventIds = emptySet())
        assertEquals(listOf("e1", "e2", "e3"), result.newlyAppliedEventIds)
        assertEquals(emptyList(), result.skippedAsAlreadyApplied)
        assertEquals(3.0, result.newCursor.lastPulledEventOrdinal)
    }

    // §9.4: a resumed cursor or retried pull re-delivering an
    // already-applied event_id is a no-op -- but the cursor still
    // advances past it, since it has still been durably seen.
    @Test fun already_applied_events_are_skipped_but_still_advance_the_cursor() {
        val events = listOf(
            PulledRemoteEvent("e1", 1.0), // already applied
            PulledRemoteEvent("e2", 2.0), // new
        )
        val result = applyPulledEvents(PullCursor("stream-1"), events, alreadyAppliedEventIds = setOf("e1"))
        assertEquals(listOf("e2"), result.newlyAppliedEventIds)
        assertEquals(listOf("e1"), result.skippedAsAlreadyApplied)
        assertEquals(2.0, result.newCursor.lastPulledEventOrdinal, "the cursor must still advance past the skipped duplicate, or it would be re-pulled forever")
    }

    // This task's own Expected Behavior: a client reconnecting after an
    // arbitrary offline duration resumes correctly from its cursor --
    // no gaps, no duplicates, across two separate pull calls.
    @Test fun reconnecting_after_an_offline_gap_resumes_with_no_gaps_or_duplicates() {
        val firstPull = listOf(PulledRemoteEvent("e1", 1.0), PulledRemoteEvent("e2", 2.0))
        val afterFirst = applyPulledEvents(PullCursor("stream-1"), firstPull, alreadyAppliedEventIds = emptySet())
        assertEquals(2.0, afterFirst.newCursor.lastPulledEventOrdinal)

        // "Arbitrary offline duration" simulated by a large ordinal gap
        // in what the next pull returns -- the server, not the cursor
        // logic, determines what "everything after the cursor" contains;
        // this device simply resumes from exactly where it left off.
        val secondPull = listOf(PulledRemoteEvent("e3", 3.0), PulledRemoteEvent("e4", 4.0))
        val afterSecond = applyPulledEvents(afterFirst.newCursor, secondPull, alreadyAppliedEventIds = emptySet())

        assertEquals(listOf("e3", "e4"), afterSecond.newlyAppliedEventIds, "no gaps -- e3/e4 are picked up exactly once, continuing from e2")
        assertEquals(4.0, afterSecond.newCursor.lastPulledEventOrdinal)
    }

    @Test fun an_empty_pull_response_leaves_the_cursor_unchanged() {
        val cursor = PullCursor("stream-1", 5.0)
        val result = applyPulledEvents(cursor, emptyList(), emptySet())
        assertEquals(cursor, result.newCursor)
    }
}
