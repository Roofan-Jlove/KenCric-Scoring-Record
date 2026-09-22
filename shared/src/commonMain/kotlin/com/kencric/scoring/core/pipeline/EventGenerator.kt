package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.MatchEvent
import com.kencric.scoring.core.model.WicketDetail

/**
 * live-scoring.md §16 (Step 12).
 *
 * CORRECTION to this task's own backlog entry, made deliberately: its
 * Expected Behavior field claims a non-striker run-out "additionally
 * emits EVT-NON-STRIKER-RUN-OUT alongside the base delivery event, per
 * §16's stated co-emission rule" -- no such co-emission rule exists.
 * §16.3's actual text is explicit: EVT-NON-STRIKER-RUN-OUT is emitted
 * "instead of EVT-DELIVERY-RECORDED for the mankad case" -- a
 * replacement, never an addition. A normal in-play `RUN_OUT` of the
 * non-striker (batters running, not a pre-delivery mankad) needs no
 * separate event at all: its `WicketDetail` already travels inside
 * `EVT-DELIVERY-RECORDED`'s own payload like any other wicket, per
 * §16.2's field table. Implemented per §16's actual text; the backlog's
 * Expected Behavior field is corrected in the change log, not silently
 * followed as written.
 *
 * `deliveryRecordedEvents` and `nonStrikerRunOutEvents` are two
 * separate functions, not one branching function, because §16.1's own
 * design decision -- "derived facts are never independently emitted" --
 * plus §16.3's "instead of" wording means these two cases share no
 * payload construction logic worth unifying; a caller picks whichever
 * applies to the input it has (mankad vs. normal delivery), never both.
 */
fun deliveryRecordedEvents(
    delivery: DeliveryInput,
    isFirstDeliveryOfMatch: Boolean,
    conditionsProfileSnapshot: String?,
): List<MatchEvent> {
    val events = mutableListOf<MatchEvent>(MatchEvent.DeliveryRecorded(delivery))
    if (isFirstDeliveryOfMatch) {
        val snapshot = requireNotNull(conditionsProfileSnapshot) {
            "conditionsProfileSnapshot is required for the match's first delivery (§16.5)"
        }
        events.add(MatchEvent.PlayingConditionsFrozen(snapshot))
    }
    return events
}

/**
 * §16.3's mankad case. `isFirstDeliveryOfMatch`/`§16.5` is deliberately
 * NOT wired into this function: §16.5's text ties `EVT-PLAYING-
 * CONDITIONS-FROZEN` specifically to "the very first
 * `EVT-DELIVERY-RECORDED`," not to the match's first event of any kind.
 * OPEN EDGE CASE, flagged rather than silently resolved either way: if
 * a mankad is genuinely the very first event of a match (dismissed
 * before any ball is ever bowled), §16.5's literal wording leaves
 * `EVT-PLAYING-CONDITIONS-FROZEN` un-emitted until the actual first
 * `EVT-DELIVERY-RECORDED`, which may be several deliveries later. Not
 * resolved here -- a genuine spec ambiguity, not a bug in this function.
 */
fun nonStrikerRunOutEvent(
    strikerBatterId: String,
    nonStrikerBatterId: String,
    bowlerId: String,
    wicket: WicketDetail,
    incomingBatterId: String?,
): MatchEvent.NonStrikerRunOut = MatchEvent.NonStrikerRunOut(
    strikerBatterId = strikerBatterId,
    nonStrikerBatterId = nonStrikerBatterId,
    bowlerId = bowlerId,
    wicket = wicket,
    incomingBatterId = incomingBatterId,
)
