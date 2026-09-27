package com.kencric.scoring.ui.screens.ux23offlinemode

import com.kencric.scoring.core.sync.OutboxState
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

/**
 * `TASK-0082`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-23-offline-mode/connectivityState.test.ts`
 * (`TASK-0081`) input-for-input, using the real `core.sync.OutboxState`
 * for the queued-count figure.
 */
class ConnectivityStateTest {

    private val emptyOutbox = OutboxState()
    private val queuedOutbox = OutboxState(committedEventIdsInOrder = listOf("e1", "e2", "e3"))

    private fun inputs(
        isOnline: Boolean = true,
        isBackendReachable: Boolean = true,
        isSyncing: Boolean = false,
        outbox: OutboxState = emptyOutbox,
    ) = ConnectivityStateInputs(isOnline, isBackendReachable, isSyncing, outbox)

    @Test fun online_synced_when_online_reachable_not_syncing_nothing_queued() {
        assertEquals(ConnectivityStatus.ONLINE_SYNCED, deriveConnectivityStatus(inputs()))
    }

    @Test fun online_syncing_when_online_and_actively_syncing() {
        assertEquals(ConnectivityStatus.ONLINE_SYNCING, deriveConnectivityStatus(inputs(isSyncing = true)))
    }

    @Test fun offline_with_queue_when_offline_with_items_pending() {
        assertEquals(
            ConnectivityStatus.OFFLINE_WITH_QUEUE,
            deriveConnectivityStatus(inputs(isOnline = false, outbox = queuedOutbox)),
        )
    }

    @Test fun offline_caught_up_when_offline_with_nothing_pending() {
        assertEquals(ConnectivityStatus.OFFLINE_CAUGHT_UP, deriveConnectivityStatus(inputs(isOnline = false)))
    }

    // NFR-014
    @Test fun backend_degraded_when_online_but_the_backend_is_not_reachable() {
        assertEquals(
            ConnectivityStatus.BACKEND_DEGRADED,
            deriveConnectivityStatus(inputs(isOnline = true, isBackendReachable = false)),
        )
    }

    @Test fun backend_degraded_takes_priority_even_while_queued_items_exist() {
        assertEquals(
            ConnectivityStatus.BACKEND_DEGRADED,
            deriveConnectivityStatus(inputs(isOnline = true, isBackendReachable = false, outbox = queuedOutbox)),
        )
    }

    @Test fun statusMessage_uses_the_exact_quoted_phrasing_for_a_genuine_offline_queue() {
        assertEquals("You're offline — carry on, we'll sync later", statusMessage(ConnectivityStatus.OFFLINE_WITH_QUEUE))
    }

    @Test fun statusMessage_uses_distinct_phrasing_for_backend_degraded() {
        val degraded = statusMessage(ConnectivityStatus.BACKEND_DEGRADED)
        assertNotEquals(degraded, statusMessage(ConnectivityStatus.OFFLINE_WITH_QUEUE))
        assertTrue(degraded.contains("trouble reaching the server"))
    }

    @Test fun statusIconLabel_gives_a_distinct_label_per_status() {
        assertEquals("cloud", statusIconLabel(ConnectivityStatus.ONLINE_SYNCED))
        assertEquals("cloud-off", statusIconLabel(ConnectivityStatus.OFFLINE_WITH_QUEUE))
        assertEquals("cloud-alert", statusIconLabel(ConnectivityStatus.BACKEND_DEGRADED))
    }
}
