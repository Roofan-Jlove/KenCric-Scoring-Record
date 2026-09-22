package com.kencric.scoring.core.model

/**
 * live-scoring.md §16 (Step 12), the four domain-fact event payloads.
 *
 * SCOPE SPLIT, deliberate: only the domain-specific payload fields each
 * `§16.2-16.5` subsection actually adds are modeled here. The generic
 * envelope fields every event carries (`eventId`, `matchId`,
 * `scorerStreamId`, `deviceId`/`deviceSeq`/`hlc`/`eventOrdinal`,
 * `actorRef`, `provenance`, `recordedAt`/`serverReceivedAt`,
 * `prevHash`/`hash`, `supersedes`) are `TASK-0028`'s ("Audit record
 * generation") explicit scope per `§17` and already exist as columns on
 * `match_events` (`TASK-0006`) -- modeling them again here would
 * duplicate that task's stated scope rather than compose with it.
 */
sealed class MatchEvent {

    /**
     * §16.2. The payload IS the validated `DeliveryInput` verbatim --
     * §16.2's own field table lists exactly `DeliveryInput`'s field set
     * (`legality`, `strikerBatterId`, `nonStrikerBatterId`, `bowlerId`,
     * `isFreeHit`, `runEvents`, `shortRuns`, `wicket`, `deadBallReason`,
     * `commentary`, `overrideReason`) as "copied... verbatim" -- so this
     * wraps the existing type rather than re-declaring all 11 fields.
     */
    data class DeliveryRecorded(val delivery: DeliveryInput) : MatchEvent()

    /**
     * §16.3. Emitted INSTEAD OF [DeliveryRecorded] for the pre-delivery
     * mankad case (§9.6) -- never alongside it, no ball was bowled.
     * §16.3's own text: "mirrors §16.2 minus legality/runEvents/isFreeHit
     * ... plus wicket ... and incomingBatterId" -- `shortRuns`/
     * `deadBallReason`/`commentary`/`overrideReason` are literally still
     * listed as carried over despite most having no real meaning
     * pre-delivery; kept for fidelity to the spec's literal wording
     * rather than second-guessed away.
     */
    data class NonStrikerRunOut(
        val strikerBatterId: String,
        val nonStrikerBatterId: String,
        val bowlerId: String,
        /** Always `RUN_OUT`, `endVacated = NON_STRIKER` per §16.3. */
        val wicket: WicketDetail,
        val incomingBatterId: String?,
        val shortRuns: Int = 0,
        val deadBallReason: String? = null,
        val commentary: String? = null,
        val overrideReason: String? = null,
    ) : MatchEvent()

    /** §16.4. Independent of any delivery event (§14.5's manual override, `UX-14`). */
    data class StrikerOverridden(
        val newStrikerBatterId: String,
        val newNonStrikerBatterId: String,
        val reason: String,
    ) : MatchEvent()

    /**
     * §16.5. Emitted once, alongside the match's very first
     * [DeliveryRecorded], never again (`MBR-05`).
     *
     * `conditionsProfileSnapshot` is a serialized string, not
     * `config.PlayingConditionsProfile` -- that type only carries the
     * one key (`ballsPerOver`) `TASK-0024` needed, not the full
     * `CFG-REG` registry (`cricket-rules-reference.md §35`) this "snapshot
     * of the resolved ConditionsProfile" actually refers to; the full
     * typed shape remains unmodeled, same gap `TASK-0016`'s
     * `ReferenceDataPort` already flagged.
     */
    data class PlayingConditionsFrozen(val conditionsProfileSnapshot: String) : MatchEvent()

    /**
     * §18.1 step 2, added during `TASK-0029` (Undo) -- `§16` itself only
     * mentions this event's existence in passing ("Emit
     * `EVT-DELIVERY-VOIDED` (or the equivalent void marker...)") with no
     * dedicated field table the way `§16.2-16.5` each got one. Modeled
     * minimally per what §18.1's text actually specifies: a reference to
     * the voided event's `eventId`, nothing more. `voidedEventId` refers
     * to an `AuditedEvent.eventId` (`TASK-0028`), not a `MatchEvent`
     * itself -- the envelope, not the payload, is what carries identity.
     */
    data class DeliveryVoided(val voidedEventId: String) : MatchEvent()
}
