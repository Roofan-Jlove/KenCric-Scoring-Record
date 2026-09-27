package com.kencric.scoring.ui.screens.ux24syncstatus

import com.kencric.scoring.core.sync.PushEventOutcome
import com.kencric.scoring.core.sync.PushOutcomeStatus
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * `TASK-0084`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-24-sync-status/syncStatusState.test.ts`
 * (`TASK-0083`) input-for-input, using the real `core.sync.
 * PushEventOutcome`/`PushOutcomeStatus` types.
 */
class SyncStatusStateTest {

    private fun inputs(
        isOnline: Boolean = true,
        isBackendReachable: Boolean = true,
        isSyncing: Boolean = false,
        rejectedCount: Int = 0,
    ) = SyncStateInputs(isOnline, isBackendReachable, isSyncing, rejectedCount)

    @Test fun idle_synced_when_online_reachable_not_syncing_nothing_rejected() {
        assertEquals(SyncStatus.IDLE_SYNCED, deriveSyncStatus(inputs()))
    }

    @Test fun syncing_when_online_and_actively_syncing_with_no_rejections() {
        assertEquals(SyncStatus.SYNCING, deriveSyncStatus(inputs(isSyncing = true)))
    }

    @Test fun partial_failure_when_any_event_is_rejected_taking_priority_over_an_in_progress_sync() {
        assertEquals(SyncStatus.PARTIAL_FAILURE, deriveSyncStatus(inputs(isSyncing = true, rejectedCount = 1)))
    }

    @Test fun fully_offline_when_offline_regardless_of_rejected_count() {
        assertEquals(SyncStatus.FULLY_OFFLINE, deriveSyncStatus(inputs(isOnline = false, rejectedCount = 2)))
    }

    @Test fun backend_degraded_when_online_but_the_backend_is_not_reachable() {
        assertEquals(SyncStatus.BACKEND_DEGRADED, deriveSyncStatus(inputs(isBackendReachable = false)))
    }

    @Test fun backend_degraded_takes_priority_over_everything_else() {
        assertEquals(
            SyncStatus.BACKEND_DEGRADED,
            deriveSyncStatus(inputs(isBackendReachable = false, isSyncing = true, rejectedCount = 3)),
        )
    }

    private val accepted = PushEventOutcome(eventId = "e1", status = PushOutcomeStatus.ACCEPTED, rejectionReason = null)
    private val rejected = PushEventOutcome(eventId = "e2", status = PushOutcomeStatus.REJECTED, rejectionReason = "Validation failed")

    @Test fun rejectedOutcomes_filters_to_just_the_rejected_entries() {
        assertEquals(listOf(rejected), rejectedOutcomes(listOf(accepted, rejected)))
    }

    @Test fun rejectedOutcomes_returns_an_empty_list_when_nothing_was_rejected() {
        assertEquals(emptyList(), rejectedOutcomes(listOf(accepted)))
    }

    @Test fun formatRejectionMessage_wraps_a_known_reason_in_a_plain_language_sentence() {
        assertEquals("This item couldn't be synced: Validation failed", formatRejectionMessage("Validation failed"))
    }

    @Test fun formatRejectionMessage_falls_back_to_a_generic_message_when_no_reason_is_given() {
        assertEquals("This item couldn't be synced — please review it", formatRejectionMessage(null))
    }
}
