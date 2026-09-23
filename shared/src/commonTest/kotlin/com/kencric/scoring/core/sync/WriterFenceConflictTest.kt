package com.kencric.scoring.core.sync

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class WriterFenceConflictTest {

    // §11.1: "no third, automatic option exists" -- structurally
    // confirmed, not just asserted in prose.
    @Test fun exactly_two_resolution_options_exist() {
        // .values() rather than the newer .entries -- kept compatible
        // with any Kotlin 1.x target, since no Gradle build exists to
        // confirm which version this project would actually compile
        // against.
        val values = FenceConflictResolution.values()
        assertEquals(2, values.size)
        assertTrue(values.toList().containsAll(listOf(FenceConflictResolution.TAKE_OVER, FenceConflictResolution.DISCARD_LOCALLY)))
    }

    @Test fun taking_over_records_the_new_fence_for_that_stream_only() {
        var cache = FenceCache()
        cache = takeOverFence(cache, "stream-1", "fence-new")
        assertEquals("fence-new", cache.fenceByStream["stream-1"])
        assertEquals(null, cache.fenceByStream["stream-2"])
    }

    @Test fun taking_over_a_second_time_replaces_the_cached_value() {
        var cache = takeOverFence(FenceCache(), "stream-1", "fence-A")
        cache = takeOverFence(cache, "stream-1", "fence-B")
        assertEquals("fence-B", cache.fenceByStream["stream-1"])
    }
}

class DiscardLocallyTest {

    // §11.1 option 2: discarded events leave `pending()` but are never
    // deleted from the outbox's own record -- MINV-01 extends to local storage.
    @Test fun discarded_events_leave_pending_but_stay_in_the_committed_record() {
        var outbox = OutboxState()
        outbox = recordCommit(outbox, "e0")
        outbox = recordCommit(outbox, "e1")
        outbox = discardLocally(outbox, setOf("e0"))

        assertEquals(listOf("e1"), outbox.pending())
        assertEquals(listOf("e0", "e1"), outbox.committedEventIdsInOrder, "discarding never deletes the record -- MINV-01 extends to local storage")
    }

    @Test fun a_discarded_event_is_distinct_from_an_acknowledged_one() {
        var outbox = OutboxState()
        outbox = recordCommit(outbox, "e0")
        outbox = recordCommit(outbox, "e1")
        outbox = acknowledge(outbox, "e0")
        outbox = discardLocally(outbox, setOf("e1"))

        assertTrue(outbox.acknowledgedEventIds.contains("e0"))
        assertTrue(outbox.abandonedEventIds.contains("e1"))
        assertEquals(emptyList(), outbox.pending(), "both e0 (acknowledged) and e1 (discarded) leave pending, via two distinct mechanisms")
    }
}
