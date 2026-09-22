package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.CreaseEnd
import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.MatchEvent
import com.kencric.scoring.core.model.WicketDetail
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/**
 * live-scoring.md §16. Confirms the correction made to this task's own
 * backlog entry: a normal in-play non-striker run-out never gets a
 * separate event (its WicketDetail travels inside EVT-DELIVERY-RECORDED
 * like any other wicket); only the pre-delivery mankad case (§9.6) uses
 * EVT-NON-STRIKER-RUN-OUT, and INSTEAD OF the delivery event, not
 * alongside it (§16.3).
 */
class EventGeneratorTest {

    private val plainDelivery = DeliveryInput(
        legality = Legality.LEGAL,
        strikerBatterId = "A",
        nonStrikerBatterId = "B",
        bowlerId = "X",
        isFreeHit = false,
    )

    @Test fun non_first_delivery_emits_only_delivery_recorded() {
        val events = deliveryRecordedEvents(plainDelivery, isFirstDeliveryOfMatch = false, conditionsProfileSnapshot = null)
        assertEquals(1, events.size)
        assertTrue(events[0] is MatchEvent.DeliveryRecorded)
        assertEquals(plainDelivery, (events[0] as MatchEvent.DeliveryRecorded).delivery)
    }

    // §16.5: emitted once, alongside the very first EVT-DELIVERY-RECORDED.
    @Test fun first_delivery_of_match_also_emits_playing_conditions_frozen() {
        val events = deliveryRecordedEvents(plainDelivery, isFirstDeliveryOfMatch = true, conditionsProfileSnapshot = "{...}")
        assertEquals(2, events.size)
        assertTrue(events[0] is MatchEvent.DeliveryRecorded)
        val frozen = events[1]
        assertTrue(frozen is MatchEvent.PlayingConditionsFrozen)
        assertEquals("{...}", (frozen as MatchEvent.PlayingConditionsFrozen).conditionsProfileSnapshot)
    }

    @Test fun first_delivery_without_a_snapshot_fails_loudly() {
        assertFailsWith<IllegalArgumentException> {
            deliveryRecordedEvents(plainDelivery, isFirstDeliveryOfMatch = true, conditionsProfileSnapshot = null)
        }
    }

    // The correction under test: a normal in-play RUN_OUT of the
    // non-striker is carried entirely inside DeliveryRecorded's own
    // payload -- no NonStrikerRunOut event is ever produced for it.
    @Test fun in_play_non_striker_run_out_produces_no_separate_event() {
        val deliveryWithRunOut = plainDelivery.copy(
            runEvents = emptyList(),
            wicket = WicketDetail(
                mode = DismissalMode.RUN_OUT,
                outBatterId = "B",
                endVacated = CreaseEnd.NON_STRIKER,
                crossedBeforeDismissal = false,
                incomingBatterId = "C",
            ),
        )
        val events = deliveryRecordedEvents(deliveryWithRunOut, isFirstDeliveryOfMatch = false, conditionsProfileSnapshot = null)
        assertEquals(1, events.size, "the wicket travels inside the one DeliveryRecorded event, per §16.2")
        assertTrue(events.none { it is MatchEvent.NonStrikerRunOut })
    }

    // §9.6/§16.3: the pre-delivery mankad -- its own dedicated event.
    @Test fun mankad_produces_a_non_striker_run_out_event() {
        val wicket = WicketDetail(
            mode = DismissalMode.RUN_OUT,
            outBatterId = "B",
            endVacated = CreaseEnd.NON_STRIKER,
            incomingBatterId = "C",
        )
        val event = nonStrikerRunOutEvent(
            strikerBatterId = "A",
            nonStrikerBatterId = "B",
            bowlerId = "X",
            wicket = wicket,
            incomingBatterId = "C",
        )
        assertEquals(wicket, event.wicket)
        assertEquals("A", event.strikerBatterId)
        assertEquals("C", event.incomingBatterId)
    }
}
