package com.kencric.scoring.core.sync

/** offline-first-specification.md §7.1's own `[DEFAULT]` batch size. */
const val DEFAULT_MAX_BATCH_SIZE = 200

/** §7.1 steps 1-2: one push batch for one stream. */
data class PushBatch(
    val deviceId: String,
    /** FIFO order (§6.3) -- at most [DEFAULT_MAX_BATCH_SIZE] event ids from the outbox head. */
    val eventIds: List<String>,
    /** The device_seq this device believes is its next unconfirmed one -- redundant with, but cross-checkable against, the batch's first event. */
    val expectedNextSeq: Long,
)

/** Forms one push batch from [outbox]'s pending items, or null if there is nothing to push. */
fun formPushBatch(outbox: OutboxState, deviceId: String, expectedNextSeq: Long, maxBatchSize: Int = DEFAULT_MAX_BATCH_SIZE): PushBatch? {
    val pending = outbox.pending()
    if (pending.isEmpty()) return null
    return PushBatch(deviceId, pending.take(maxBatchSize), expectedNextSeq)
}

enum class PushOutcomeStatus { ACCEPTED, REJECTED }

/** §7.1 step 3's per-event outcome, as returned by the server. */
data class PushEventOutcome(val eventId: String, val status: PushOutcomeStatus, val rejectionReason: String? = null)

/**
 * §7.1 step 4 / §7.2: advances the outbox exactly as far as the
 * **contiguous prefix** of `ACCEPTED` outcomes, starting from the
 * current head -- never past a `REJECTED` item, regardless of what
 * came after it in the batch. This is the client-side half of the same
 * invariant `backend/src/sync/ingestPushBatch.ts`'s server-side
 * counterpart enforces from the other end.
 */
fun applyPushOutcomes(outbox: OutboxState, outcomes: List<PushEventOutcome>): OutboxState {
    var result = outbox
    for (outcome in outcomes) {
        if (outcome.status != PushOutcomeStatus.ACCEPTED) break
        result = acknowledge(result, outcome.eventId)
    }
    return result
}
