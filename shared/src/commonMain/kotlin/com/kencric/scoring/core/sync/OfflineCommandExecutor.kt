package com.kencric.scoring.core.sync

import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.persistence.DurableEventLogWriter
import com.kencric.scoring.core.pipeline.applyDelivery

/**
 * offline-first-specification.md §4.2's central invariant: "Offline
 * commands execute immediately, fully, against local state -- they are
 * never queued for later execution. Only the transmission of the
 * resulting event(s) to the server is queued." A scorer recording a
 * delivery does not wait for anything network-related.
 *
 * This function makes that guarantee structurally checkable, not merely
 * asserted: its signature has no network port to call at all (`FA-15`
 * -- "the network is never on this path" -- is true by construction,
 * since there is nothing here capable of reaching one). It composes,
 * in order: `TASK-0029`'s `applyDelivery` (local projection update,
 * pure), `TASK-0033`'s `DurableEventLogWriter.commit` (durable local
 * persistence, §3.1), and `recordCommit` (marks the event pending
 * transmission, §6.1) -- exactly `§4.2`'s three consequences of one
 * offline command, nothing more.
 */
data class OfflineCommandResult(
    val newState: InningsFoldState,
    val newOutbox: OutboxState,
)

suspend fun executeOfflineDeliveryCommand(
    state: InningsFoldState,
    outbox: OutboxState,
    delivery: DeliveryInput,
    config: FoldConfig,
    streamId: String,
    deviceSeq: Long,
    eventId: String,
    serialize: (DeliveryInput) -> String,
    writer: DurableEventLogWriter,
): OfflineCommandResult {
    val newState = applyDelivery(state, delivery, config)
    writer.commit(streamId, deviceSeq, serialize(delivery))
    val newOutbox = recordCommit(outbox, eventId)
    return OfflineCommandResult(newState, newOutbox)
}
