package com.kencric.scoring.core.sync

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class PushBatcherTest {

    @Test fun an_empty_outbox_forms_no_batch() {
        assertNull(formPushBatch(OutboxState(), deviceId = "d1", expectedNextSeq = 0))
    }

    @Test fun a_batch_carries_the_pending_items_in_fifo_order() {
        var outbox = OutboxState()
        outbox = recordCommit(outbox, "e0")
        outbox = recordCommit(outbox, "e1")
        outbox = recordCommit(outbox, "e2")

        val batch = formPushBatch(outbox, deviceId = "d1", expectedNextSeq = 0)
        assertEquals(listOf("e0", "e1", "e2"), batch?.eventIds)
    }

    // §7.1's own [DEFAULT]: at most maxBatchSize items, still FIFO.
    @Test fun a_batch_is_capped_at_max_batch_size() {
        var outbox = OutboxState()
        repeat(5) { outbox = recordCommit(outbox, "e$it") }

        val batch = formPushBatch(outbox, deviceId = "d1", expectedNextSeq = 0, maxBatchSize = 3)
        assertEquals(listOf("e0", "e1", "e2"), batch?.eventIds)
    }

    @Test fun already_acknowledged_items_never_appear_in_a_new_batch() {
        var outbox = OutboxState()
        outbox = recordCommit(outbox, "e0")
        outbox = recordCommit(outbox, "e1")
        outbox = acknowledge(outbox, "e0")

        val batch = formPushBatch(outbox, deviceId = "d1", expectedNextSeq = 1)
        assertEquals(listOf("e1"), batch?.eventIds)
    }

    // §7.1 step 4 / §7.2: all-accepted advances the whole batch.
    @Test fun all_accepted_outcomes_advance_the_whole_batch() {
        var outbox = OutboxState()
        outbox = recordCommit(outbox, "e0")
        outbox = recordCommit(outbox, "e1")

        val outcomes = listOf(
            PushEventOutcome("e0", PushOutcomeStatus.ACCEPTED),
            PushEventOutcome("e1", PushOutcomeStatus.ACCEPTED),
        )
        val result = applyPushOutcomes(outbox, outcomes)
        assertEquals(emptyList(), result.pending())
    }

    // The central §7.1 step 4 claim: the outbox advances only up to the
    // CONTIGUOUS prefix of ACCEPTED outcomes -- an ACCEPTED item that
    // comes AFTER a REJECTED one in the same batch is NOT acknowledged,
    // even though the server accepted it individually.
    @Test fun advancement_stops_at_the_first_rejection_even_if_later_items_were_accepted() {
        var outbox = OutboxState()
        outbox = recordCommit(outbox, "e0")
        outbox = recordCommit(outbox, "e1")
        outbox = recordCommit(outbox, "e2")
        outbox = recordCommit(outbox, "e3")

        val outcomes = listOf(
            PushEventOutcome("e0", PushOutcomeStatus.ACCEPTED),
            PushEventOutcome("e1", PushOutcomeStatus.REJECTED, "STALE_FENCE"),
            PushEventOutcome("e2", PushOutcomeStatus.ACCEPTED),
            PushEventOutcome("e3", PushOutcomeStatus.ACCEPTED),
        )
        val result = applyPushOutcomes(outbox, outcomes)
        assertEquals(listOf("e1", "e2", "e3"), result.pending(), "only e0 (the contiguous accepted prefix) advances -- e2/e3 stay pending despite being individually ACCEPTED")
    }
}
