package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.AuditedEvent
import com.kencric.scoring.core.model.EventProvenance
import com.kencric.scoring.core.model.MatchEvent
import com.kencric.scoring.core.ports.ClockPort
import com.kencric.scoring.core.ports.IdPort

/**
 * live-scoring.md §17 (Step 13). The first pipeline function to compose
 * `TASK-0016`'s `ClockPort`/`IdPort` -- `eventId`/`recordedAt` must come
 * from these ports, never a direct UUID/system-clock call, per §1.1's
 * determinism boundary (restated on the ports' own doc comments).
 *
 * `prevHash`/`hash` remain caller-supplied -- see `AuditedEvent`'s own
 * HONEST GAP note; this function does not compute them (no canonical
 * serialization format for a `MatchEvent` exists anywhere in this
 * backlog yet).
 */
fun auditEvent(
    event: MatchEvent,
    matchId: String,
    inningsId: String,
    scorerStreamId: String,
    deviceId: String,
    deviceSeq: Long,
    hlc: String,
    eventOrdinal: String,
    actorRef: String,
    provenance: EventProvenance,
    prevHash: String,
    hash: String,
    idPort: IdPort,
    clockPort: ClockPort,
    supersedes: String? = null,
): AuditedEvent = AuditedEvent(
    eventId = idPort.newId(),
    matchId = matchId,
    inningsId = inningsId,
    scorerStreamId = scorerStreamId,
    deviceId = deviceId,
    deviceSeq = deviceSeq,
    hlc = hlc,
    eventOrdinal = eventOrdinal,
    event = event,
    actorRef = actorRef,
    provenance = provenance,
    recordedAt = clockPort.nowEpochMillis(),
    prevHash = prevHash,
    hash = hash,
    supersedes = supersedes,
)
