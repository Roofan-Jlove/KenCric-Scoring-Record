package com.kencric.scoring.core.model

/**
 * live-scoring.md §16.2's `provenance` field: `appVersion`/`buildHash`
 * specifically "enable reproducing a historical bug against the exact
 * logic that produced a given event" (§17.2) -- captured at write time,
 * never reconstructed later, which is why this is a required
 * constructor argument on [AuditedEvent], not an optional/backfillable
 * one.
 */
data class EventProvenance(
    val appVersion: String,
    val platform: String,
    val deviceModel: String,
    val osVersion: String,
    val buildHash: String,
)

/**
 * live-scoring.md §17: "every event in §16 **is** its own audit record
 * -- there is no separate audit-log write." This type IS the
 * `AuditRecord` this task's own Files/components field names -- not a
 * distinct type alongside `MatchEvent`, but the generic attribution
 * envelope wrapping one, exactly what `TASK-0027`'s `EventGenerator.kt`
 * doc comment deferred to this task as its "explicit §17 scope."
 * Mirrors `match_events`' own columns (`TASK-0006`/`TASK-0007`) so the
 * Kotlin shape and the persisted shape agree field-for-field.
 *
 * §17's five numbered requirements, as they show up on this type:
 * 1. `actorRef` is non-nullable `String` -- never null, never inferred,
 *    by construction (§17.1).
 * 2. `provenance` is a required constructor argument, not optional or
 *    settable after the fact (§17.2).
 * 3. `prevHash`/`hash` are required `String` inputs the caller supplies
 *    -- see the HONEST GAP note below; this type does not compute them.
 * 4. `event: MatchEvent` carries any `overrideReason` (or other reason
 *    field) inside its own payload already (`DeliveryInput`,
 *    `TASK-0017`), never as a bolt-on field here -- satisfied by
 *    composition, not a separate mechanism (§17.4).
 * 5. One envelope shape wraps every `MatchEvent` variant uniformly --
 *    `LEGAL`/`WIDE`/`NO_BALL`/`DEAD_BALL`/wicket deliveries all go
 *    through the same `AuditedEvent`, no per-case branching (§17.5).
 *
 * HONEST GAP, flagged not silently assumed: `prevHash`/`hash` are
 * modeled as required `String` fields (mirroring `match_events.prev_
 * hash`/`.hash`, which likewise have "no default -- the caller always
 * supplies it explicitly"), but this task does NOT implement the actual
 * hash computation (§17.3's "canonicalised serialisation... stable
 * field order, fixed number formatting"). No canonical serialization
 * format for a `MatchEvent` has been chosen anywhere in this backlog --
 * `EventLogPort` (`TASK-0016`) deliberately defers "already-serialized"
 * payloads to an unspecified future mechanism, and this task inherits
 * that same open dependency rather than inventing a format to close it.
 *
 * ALSO FLAGGED: this task's own Acceptance Criteria field cites
 * `security-specification.md §11`'s `SR-I01…I04` -- read in full, all
 * four are database-grant / scheduled-job / API-authz requirements
 * (append-only grants, admin-audit-log completeness, scheduled hash-
 * chain verification, role-gated audit-trail read access), not shared/
 * Kotlin domain-model requirements at all. `SR-I01` is already satisfied
 * by `TASK-0007`'s grants; `SR-I02`/`I03`/`I04` are not implemented
 * anywhere in this backlog and are out of this task's actual buildable
 * scope -- a real gap for whichever future backend/infra task owns
 * them, not something this type can satisfy by itself.
 */
data class AuditedEvent(
    val eventId: String,
    val matchId: String,
    val inningsId: String,
    val scorerStreamId: String,
    val deviceId: String,
    val deviceSeq: Long,
    val hlc: String,
    val eventOrdinal: String,
    val event: MatchEvent,
    val actorRef: String,
    val provenance: EventProvenance,
    val recordedAt: Long,
    val serverReceivedAt: Long? = null,
    val prevHash: String,
    val hash: String,
    val supersedes: String? = null,
)
