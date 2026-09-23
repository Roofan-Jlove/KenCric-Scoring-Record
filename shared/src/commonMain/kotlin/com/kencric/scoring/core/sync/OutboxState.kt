package com.kencric.scoring.core.sync

/**
 * offline-first-specification.md §6.1: "an ordered view over the local
 * event log... not a separate, independently-writable store." Modeled
 * here as exactly that -- a pure derivation over two lists this type
 * carries, never a separately-mutated store a bare `enqueue()` call
 * could let diverge from what was actually committed (the risk §6.1
 * explicitly rules out: "committed" and "queued for sync" can never
 * diverge).
 *
 * §6.2's full "what is queued" list (every `§16` domain event type plus
 * publish/notify intents with their own idempotency key) and §6.5's
 * backpressure/chunking policy are deliberately NOT modeled here --
 * `TASK-0034`'s own Requirement IDs field is `§4` only, and `TASK-0035`
 * (Push protocol) is the task that actually consumes and extends this
 * outbox against a real transport; this type carries exactly what
 * `§4.2`'s "only the resulting event is queued" guarantee needs.
 */
data class OutboxState(
    val committedEventIdsInOrder: List<String> = emptyList(),
    val acknowledgedEventIds: Set<String> = emptySet(),
) {
    /** §6.3: strictly FIFO -- index 0, if present, is the only item that may be transmitted next for this stream. */
    fun pending(): List<String> = committedEventIdsInOrder.filter { it !in acknowledgedEventIds }
}

/** Records that [eventId] has just been durably committed (§3.1) -- it is now pending transmission. */
fun recordCommit(outbox: OutboxState, eventId: String): OutboxState =
    outbox.copy(committedEventIdsInOrder = outbox.committedEventIdsInOrder + eventId)

/** §6.4: an item leaves the outbox only on an explicit, per-event_id server acknowledgment -- never speculatively, never by batch-level HTTP success alone. */
fun acknowledge(outbox: OutboxState, eventId: String): OutboxState =
    outbox.copy(acknowledgedEventIds = outbox.acknowledgedEventIds + eventId)
