package com.kencric.scoring.core.persistence

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
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * offline-first-specification.md §3.1/§3.3/§3.4, `TASK-0033`.
 *
 * HONEST DEPENDENCY NOTE: these tests call `suspend` functions
 * (`EventLogPort`'s own established shape, `TASK-0016`) and so need
 * `kotlinx-coroutines-test`'s `runTest` -- like every other `shared/`
 * dependency in this backlog, this is not wired to an actual Gradle
 * build (none exists), so this remains unexecuted, same caveat as every
 * task since `TASK-0016`.
 */
class DurableEventLogWriterTest {

    // §3.3: sequential commits succeed; a gap is rejected as a defect.
    @Test fun sequential_device_seq_commits_succeed() = runTest {
        val writer = DurableEventLogWriter(InMemoryEventLogPort(mutableListOf()))
        writer.commit("stream-1", 0, "event-0")
        writer.commit("stream-1", 1, "event-1")
        writer.commit("stream-1", 2, "event-2")
    }

    @Test fun a_gap_in_device_seq_is_rejected() = runTest {
        val writer = DurableEventLogWriter(InMemoryEventLogPort(mutableListOf()))
        writer.commit("stream-1", 0, "event-0")
        assertFailsWith<IllegalStateException> {
            writer.commit("stream-1", 2, "event-2") // skips 1
        }
    }

    @Test fun a_reused_device_seq_is_rejected() = runTest {
        val writer = DurableEventLogWriter(InMemoryEventLogPort(mutableListOf()))
        writer.commit("stream-1", 0, "event-0")
        writer.commit("stream-1", 1, "event-1")
        assertFailsWith<IllegalStateException> {
            writer.commit("stream-1", 1, "event-1-again")
        }
    }

    // Two independent streams (e.g. dual-scorer devices) track their
    // own sequence independently -- §3.3's invariant is per-stream.
    @Test fun independent_streams_track_their_own_sequence() = runTest {
        val writer = DurableEventLogWriter(InMemoryEventLogPort(mutableListOf()))
        writer.commit("stream-A", 0, "a-0")
        writer.commit("stream-B", 0, "b-0")
        writer.commit("stream-A", 1, "a-1")
        writer.commit("stream-B", 1, "b-1")
    }

    // §3.1's durability contract: once commit() has returned, the event
    // must survive a simulated process crash -- proven by constructing a
    // FRESH InMemoryEventLogPort against the SAME backing store,
    // simulating "process restarted, re-read from durable storage."
    @Test fun a_committed_event_survives_a_simulated_crash_and_restart() = runTest {
        val backingStore = mutableListOf<String>()
        val writerBeforeCrash = DurableEventLogWriter(InMemoryEventLogPort(backingStore))
        writerBeforeCrash.commit("stream-1", 0, "the-recorded-delivery")

        // Simulated crash: a brand new port instance, same backing store,
        // exactly as a fresh process reading persisted storage on restart.
        val portAfterRestart = InMemoryEventLogPort(backingStore)
        val recovered = portAfterRestart.readAll()

        assertEquals(listOf("the-recorded-delivery"), recovered, "the event must exist on restart -- no data loss (NFR-009)")
    }

    // §3.4: recovery folds the active event log from the beginning via
    // the same mechanism §18.1/§19.1 already use (TASK-0029's
    // foldInnings), not a re-derivation.
    @Test fun recovery_folds_the_persisted_log_from_the_beginning() = runTest {
        val backingStore = mutableListOf<String>()
        val writer = DurableEventLogWriter(InMemoryEventLogPort(backingStore))
        // A trivial serialized form: just the run count, decoded back
        // by the fake deserializer below -- stands in for real JSON,
        // which no dependency exists to produce (see RecoveryLoader.kt).
        writer.commit("stream-1", 0, "0") // dot ball
        writer.commit("stream-1", 1, "1") // single

        val genesis = InningsFoldState(
            batterCardLines = emptyMap(), bowlerCardLines = emptyMap(),
            score = InningsScoreState(), over = OverState(overNumber = 1, bowlerId = "X"),
            strikerBatterId = "A", nonStrikerBatterId = "B",
            freeHitPending = false, inningsEndReason = null,
        )
        val config = FoldConfig(
            profile = PlayingConditionsProfile(ballsPerOver = 6), bowlingTeamId = "fielding",
            maxWicketsPerInnings = 10, oversAllotted = 20, target = null,
        )
        val fakeDeserialize: (String) -> DeliveryInput = { runsAsString ->
            val runs = runsAsString.toInt()
            DeliveryInput(
                legality = Legality.LEGAL, strikerBatterId = "A", nonStrikerBatterId = "B", bowlerId = "X",
                isFreeHit = false,
                runEvents = if (runs == 0) emptyList() else listOf(RunEvent(OFF_BAT, runs, RUN)),
            )
        }

        val recovered = recoverInningsState(InMemoryEventLogPort(backingStore), genesis, config, fakeDeserialize)

        assertEquals(2, recovered.batterCardLines["A"]?.ballsFaced)
        assertEquals(1, recovered.batterCardLines["A"]?.runs, "dot ball (0) + single (1) = 1 run")
    }
}
