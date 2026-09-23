package com.kencric.scoring.core.sync

import com.kencric.scoring.core.config.PlayingConditionsProfile
import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.model.InningsScoreState
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.OverState
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.RUN
import com.kencric.scoring.core.model.RunEventOrigin.OFF_BAT
import com.kencric.scoring.core.persistence.DurableEventLogWriter
import com.kencric.scoring.core.persistence.InMemoryEventLogPort
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * offline-first-specification.md §4.2, `TASK-0034`. Same
 * `kotlinx-coroutines-test` dependency note as `TASK-0033`'s
 * `DurableEventLogWriterTest.kt` -- these tests call `suspend`
 * functions and are not wired to a real Gradle build.
 *
 * "Airplane mode, full innings" (this task's own Verification
 * procedure) is represented as a short sequence of deliveries applied
 * with no network port reachable from `executeOfflineDeliveryCommand`'s
 * signature at all -- the guarantee is structural, not merely tested.
 */
class OfflineCommandExecutorTest {

    private val genesis = InningsFoldState(
        batterCardLines = emptyMap(), bowlerCardLines = emptyMap(),
        score = InningsScoreState(), over = OverState(overNumber = 1, bowlerId = "X"),
        strikerBatterId = "A", nonStrikerBatterId = "B",
        freeHitPending = false, inningsEndReason = null,
    )
    private val config = FoldConfig(
        profile = PlayingConditionsProfile(ballsPerOver = 6), bowlingTeamId = "fielding",
        maxWicketsPerInnings = 10, oversAllotted = 20, target = null,
    )

    private fun delivery(runs: Int) = DeliveryInput(
        legality = Legality.LEGAL, strikerBatterId = "A", nonStrikerBatterId = "B", bowlerId = "X",
        isFreeHit = false,
        runEvents = if (runs == 0) emptyList() else listOf(RunEvent(OFF_BAT, runs, RUN)),
    )

    // §4.2: a sequence of offline deliveries updates local state
    // immediately and enqueues every resulting event, entirely without
    // a network dependency.
    @Test fun offline_delivery_sequence_applies_locally_and_enqueues_everything() = runTest {
        val writer = DurableEventLogWriter(InMemoryEventLogPort(mutableListOf()))
        var state = genesis
        var outbox = OutboxState()

        // All-even-run values, deliberately -- keeps every delivery
        // credited to the same striker throughout (no rotation fires),
        // so this test stays focused on offline-execution composition
        // rather than re-exercising strike-rotation logic already
        // covered elsewhere (TASK-0025).
        val deliveries = listOf(0, 2, 4, 0)
        for ((index, runs) in deliveries.withIndex()) {
            val result = executeOfflineDeliveryCommand(
                state = state, outbox = outbox, delivery = delivery(runs), config = config,
                streamId = "stream-1", deviceSeq = index.toLong(), eventId = "event-$index",
                serialize = { it.runEvents.sumOf { e -> e.value }.toString() }, writer = writer,
            )
            state = result.newState
            outbox = result.newOutbox
        }

        assertEquals(4, state.batterCardLines["A"]?.ballsFaced)
        assertEquals(6, state.batterCardLines["A"]?.runs, "0 + 2 + 4 + 0 = 6, all credited to A since every value is even (no strike rotation fires)")
        assertEquals(listOf("event-0", "event-1", "event-2", "event-3"), outbox.pending(), "every committed event is pending -- nothing has been acknowledged (no network call ever happened)")
    }

    // §6.4: acknowledgment removes an item from pending, but the
    // durable log (§3.2, append-only) is untouched by acknowledgment --
    // these are two distinct concerns tracked separately.
    @Test fun acknowledgment_removes_from_pending_but_never_touches_the_durable_log() = runTest {
        val backingStore = mutableListOf<String>()
        val writer = DurableEventLogWriter(InMemoryEventLogPort(backingStore))
        var outbox = OutboxState()

        executeOfflineDeliveryCommand(
            state = genesis, outbox = outbox, delivery = delivery(1), config = config,
            streamId = "stream-1", deviceSeq = 0, eventId = "event-0",
            serialize = { "1" }, writer = writer,
        ).let { outbox = it.newOutbox }
        executeOfflineDeliveryCommand(
            state = genesis, outbox = outbox, delivery = delivery(0), config = config,
            streamId = "stream-1", deviceSeq = 1, eventId = "event-1",
            serialize = { "0" }, writer = writer,
        ).let { outbox = it.newOutbox }

        outbox = acknowledge(outbox, "event-0")

        assertEquals(listOf("event-1"), outbox.pending(), "event-0 has been acknowledged, event-1 has not")
        assertEquals(2, backingStore.size, "the durable log is append-only -- acknowledgment never removes anything from it (§3.2)")
    }

    @Test fun pending_is_strictly_fifo_in_commit_order() {
        var outbox = OutboxState()
        outbox = recordCommit(outbox, "c")
        outbox = recordCommit(outbox, "a")
        outbox = recordCommit(outbox, "b")
        assertEquals(listOf("c", "a", "b"), outbox.pending(), "§6.3: strictly commit order, never reordered")
    }

    @Test fun a_newly_committed_event_is_immediately_pending() {
        val outbox = recordCommit(OutboxState(), "event-x")
        assertTrue(outbox.pending().contains("event-x"))
    }
}
