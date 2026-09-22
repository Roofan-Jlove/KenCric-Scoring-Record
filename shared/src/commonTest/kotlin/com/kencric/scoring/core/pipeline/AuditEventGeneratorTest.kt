package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.EventProvenance
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.MatchEvent
import com.kencric.scoring.core.ports.ClockPort
import com.kencric.scoring.core.ports.IdPort
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * live-scoring.md §17. `FakeIdPort`/`FakeClockPort` are deterministic
 * test doubles -- the only sanctioned way `commonMain` code learns
 * "now"/generates an id is through these ports (§1.1), so tests supply
 * fakes rather than anything reaching a real clock/UUID source.
 */
class AuditEventGeneratorTest {

    private class FakeIdPort(private val id: String) : IdPort {
        override fun newId(): String = id
    }

    private class FakeClockPort(private val epochMillis: Long) : ClockPort {
        override fun nowEpochMillis(): Long = epochMillis
    }

    private val provenance = EventProvenance(
        appVersion = "1.0.0", platform = "android", deviceModel = "Pixel 8", osVersion = "14", buildHash = "abc123",
    )

    private fun sampleDelivery(overrideReason: String? = null) = DeliveryInput(
        legality = Legality.LEGAL,
        strikerBatterId = "A",
        nonStrikerBatterId = "B",
        bowlerId = "X",
        isFreeHit = false,
        overrideReason = overrideReason,
    )

    @Test fun eventId_and_recordedAt_come_from_the_supplied_ports() {
        val audited = auditEvent(
            event = MatchEvent.DeliveryRecorded(sampleDelivery()),
            matchId = "m1", inningsId = "i1", scorerStreamId = "s1",
            deviceId = "d1", deviceSeq = 1, hlc = "hlc-1", eventOrdinal = "1.0000000000",
            actorRef = "scorer-1", provenance = provenance,
            prevHash = "genesis", hash = "hash-1",
            idPort = FakeIdPort("event-abc"), clockPort = FakeClockPort(1_000_000L),
        )
        assertEquals("event-abc", audited.eventId)
        assertEquals(1_000_000L, audited.recordedAt)
    }

    // §17.4: a reason field is part of the same event, never a separate
    // "note" -- satisfied by composition: overrideReason travels inside
    // DeliveryInput/DeliveryRecorded unchanged, no separate mechanism here.
    @Test fun override_reason_survives_unseparated_inside_the_wrapped_event() {
        val audited = auditEvent(
            event = MatchEvent.DeliveryRecorded(sampleDelivery(overrideReason = "umpire consultation")),
            matchId = "m1", inningsId = "i1", scorerStreamId = "s1",
            deviceId = "d1", deviceSeq = 1, hlc = "hlc-1", eventOrdinal = "1.0000000000",
            actorRef = "scorer-1", provenance = provenance,
            prevHash = "genesis", hash = "hash-1",
            idPort = FakeIdPort("event-abc"), clockPort = FakeClockPort(1_000_000L),
        )
        val delivery = (audited.event as MatchEvent.DeliveryRecorded).delivery
        assertEquals("umpire consultation", delivery.overrideReason)
    }

    // §17.5: the same envelope shape/function handles every MatchEvent
    // variant uniformly -- no per-legality branching.
    @Test fun the_same_function_handles_every_legality_uniformly() {
        val wideDelivery = sampleDelivery().copy(legality = Legality.WIDE)
        val audited = auditEvent(
            event = MatchEvent.DeliveryRecorded(wideDelivery),
            matchId = "m1", inningsId = "i1", scorerStreamId = "s1",
            deviceId = "d1", deviceSeq = 2, hlc = "hlc-2", eventOrdinal = "1.0000000001",
            actorRef = "scorer-1", provenance = provenance,
            prevHash = "hash-1", hash = "hash-2",
            idPort = FakeIdPort("event-def"), clockPort = FakeClockPort(1_000_001L),
        )
        assertEquals("scorer-1", audited.actorRef)
        assertEquals("hash-1", audited.prevHash)
    }
}
