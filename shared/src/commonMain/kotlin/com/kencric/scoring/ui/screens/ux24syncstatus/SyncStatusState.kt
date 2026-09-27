package com.kencric.scoring.ui.screens.ux24syncstatus

import com.kencric.scoring.core.sync.PushEventOutcome
import com.kencric.scoring.core.sync.PushOutcomeStatus

/**
 * TASK-0084: `ux-specification.md UX-24`'s own logic. Unlike the web TS
 * mirror (`TASK-0083`, which necessarily redefines `PushEventOutcome`/
 * `PushOutcomeStatus` since TypeScript cannot import Kotlin types),
 * this file **genuinely imports the real `core.sync.PushEventOutcome`/
 * `PushOutcomeStatus`** directly -- the same reuse pattern `TASK-0060`/
 * `0070`/`0076`/`0080`/`0082` established.
 *
 * See `TASK-0083`'s own file for the full grounding (citation note,
 * the ball-reference accessibility gap, and the deliberate decision not
 * to reuse `TASK-0081`'s `ConnectivityStatus`).
 */

enum class SyncStatus { IDLE_SYNCED, SYNCING, PARTIAL_FAILURE, FULLY_OFFLINE, BACKEND_DEGRADED }

data class SyncStateInputs(
    val isOnline: Boolean,
    val isBackendReachable: Boolean,
    val isSyncing: Boolean,
    val rejectedCount: Int,
)

/**
 * `UX-24`'s own States, in priority order: backend-degraded, fully-
 * offline, partial-failure (rejected events need explicit action, so
 * they take priority over an in-progress sync), syncing, else idle.
 */
fun deriveSyncStatus(inputs: SyncStateInputs): SyncStatus {
    if (inputs.isOnline && !inputs.isBackendReachable) return SyncStatus.BACKEND_DEGRADED
    if (!inputs.isOnline) return SyncStatus.FULLY_OFFLINE
    if (inputs.rejectedCount > 0) return SyncStatus.PARTIAL_FAILURE
    return if (inputs.isSyncing) SyncStatus.SYNCING else SyncStatus.IDLE_SYNCED
}

fun rejectedOutcomes(outcomes: List<PushEventOutcome>): List<PushEventOutcome> =
    outcomes.filter { it.status == PushOutcomeStatus.REJECTED }

/** UX-24's own Error-handling text: plain language, never a raw error code. */
fun formatRejectionMessage(rejectionReason: String?): String =
    if (rejectionReason == null) "This item couldn't be synced — please review it" else "This item couldn't be synced: $rejectionReason"
