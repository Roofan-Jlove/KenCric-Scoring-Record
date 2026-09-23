package com.kencric.scoring.core.persistence

import com.kencric.scoring.core.ports.EventLogPort

/**
 * offline-first-specification.md §3.3's write-ordering invariant:
 * "events for a given stream are appended with a strictly increasing
 * device_seq, with no gaps and no reuse... An attempt to persist an
 * out-of-sequence device_seq is a defect, not a scenario this
 * specification accommodates." §3.3 does not state a starting
 * convention (0-based vs 1-based), so the FIRST write for a stream is
 * accepted at whatever value it declares, establishing the baseline;
 * every subsequent write must be exactly one more than the last
 * committed value.
 */
fun isValidNextDeviceSeq(lastCommittedSeq: Long?, candidateSeq: Long): Boolean =
    if (lastCommittedSeq == null) true else candidateSeq == lastCommittedSeq + 1

/**
 * offline-first-specification.md §3.1/§3.3, the local persistence
 * layer's write-ordering half of the durability contract. Wraps
 * `EventLogPort` (`TASK-0016`) with device_seq validation -- an
 * out-of-sequence write throws (a defect, per §3.3's own words, "handled
 * by §15.4, not by silently renumbering"), rather than being accepted
 * or quietly corrected.
 *
 * HONEST SCOPE NOTE: §3.1's other half -- "the UI confirms only after
 * the durable write completes" -- is enforced by Kotlin's own `suspend`
 * semantics at the call site (the caller must await `commit()` before
 * acknowledging anything to the UI); this class does not, and cannot,
 * add anything on top of that structurally. It is a calling-convention
 * contract, documented here, not independently enforceable beyond what
 * `suspend` already guarantees.
 */
class DurableEventLogWriter(private val port: EventLogPort) {
    private val lastCommittedSeqByStream = mutableMapOf<String, Long>()

    /**
     * Appends [serializedEvent] for [streamId] at [deviceSeq]. Returns
     * only once the underlying port's write has completed -- callers
     * must await this before treating the event as durably recorded
     * (§3.1). Throws [IllegalStateException] if [deviceSeq] is
     * out-of-sequence for [streamId] (§3.3) -- never writes a gap or a
     * reused value.
     */
    suspend fun commit(streamId: String, deviceSeq: Long, serializedEvent: String) {
        val last = lastCommittedSeqByStream[streamId]
        check(isValidNextDeviceSeq(last, deviceSeq)) {
            "out-of-sequence device_seq for stream $streamId: expected ${(last ?: -1L) + 1L}, got $deviceSeq (§3.3 -- a defect, never silently renumbered)"
        }
        port.append(serializedEvent)
        lastCommittedSeqByStream[streamId] = deviceSeq
    }
}
