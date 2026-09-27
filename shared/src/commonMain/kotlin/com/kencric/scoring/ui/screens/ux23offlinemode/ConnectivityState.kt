package com.kencric.scoring.ui.screens.ux23offlinemode

import com.kencric.scoring.core.sync.OutboxState

/**
 * TASK-0082: `ux-specification.md UX-23`'s own logic. Unlike the web TS
 * mirror (`TASK-0081`, which accepts a plain queued-count number since
 * TypeScript cannot import `OutboxState`), this file **genuinely
 * imports the real `core.sync.OutboxState`** and derives the queued
 * count from its own `pending()` function -- Kotlin-to-Kotlin reuse
 * across the same `shared/commonMain` source set, the same pattern
 * `TASK-0060`/`0070`/`0076`/`0080` established.
 *
 * See `TASK-0081`'s own file for the full citation note (SRS's own
 * separate "OFF-*" series; `OFF-022`'s genuine mismatch; `OFF-023`'s
 * undefined-but-referenced status).
 */

enum class ConnectivityStatus { ONLINE_SYNCED, ONLINE_SYNCING, OFFLINE_WITH_QUEUE, OFFLINE_CAUGHT_UP, BACKEND_DEGRADED }

data class ConnectivityStateInputs(
    val isOnline: Boolean,
    val isBackendReachable: Boolean,
    val isSyncing: Boolean,
    val outbox: OutboxState,
)

/**
 * `UX-23`'s own States, with `BACKEND_DEGRADED` checked first per
 * `NFR-014` -- a genuinely degraded backend while nominally online is
 * distinct from true offline. Queued count is derived from the real
 * `OutboxState.pending()`, not a caller-supplied number.
 */
fun deriveConnectivityStatus(inputs: ConnectivityStateInputs): ConnectivityStatus {
    if (inputs.isOnline && !inputs.isBackendReachable) return ConnectivityStatus.BACKEND_DEGRADED
    if (!inputs.isOnline) {
        return if (inputs.outbox.pending().isNotEmpty()) ConnectivityStatus.OFFLINE_WITH_QUEUE else ConnectivityStatus.OFFLINE_CAUGHT_UP
    }
    return if (inputs.isSyncing) ConnectivityStatus.ONLINE_SYNCING else ConnectivityStatus.ONLINE_SYNCED
}

/** UX-23's own Error-handling text: distinct copy for true-offline vs. backend-degraded, verbatim. */
fun statusMessage(status: ConnectivityStatus): String = when (status) {
    ConnectivityStatus.ONLINE_SYNCED -> "Online — all caught up"
    ConnectivityStatus.ONLINE_SYNCING -> "Online — syncing"
    ConnectivityStatus.OFFLINE_WITH_QUEUE -> "You're offline — carry on, we'll sync later"
    ConnectivityStatus.OFFLINE_CAUGHT_UP -> "You're offline — all caught up"
    ConnectivityStatus.BACKEND_DEGRADED -> "We're having trouble reaching the server — your data is safe and queued"
}

/** UX-23's own Accessibility text: "Never color-only (icon + text)." */
fun statusIconLabel(status: ConnectivityStatus): String = when (status) {
    ConnectivityStatus.ONLINE_SYNCED, ConnectivityStatus.ONLINE_SYNCING -> "cloud"
    ConnectivityStatus.OFFLINE_WITH_QUEUE, ConnectivityStatus.OFFLINE_CAUGHT_UP -> "cloud-off"
    ConnectivityStatus.BACKEND_DEGRADED -> "cloud-alert"
}
