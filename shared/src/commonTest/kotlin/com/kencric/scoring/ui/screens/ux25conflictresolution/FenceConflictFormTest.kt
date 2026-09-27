package com.kencric.scoring.ui.screens.ux25conflictresolution

import com.kencric.scoring.core.sync.FenceConflictResolution
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * `TASK-0086`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-25-conflict-resolution/
 * fenceConflictForm.test.ts` (`TASK-0085`) input-for-input, using the
 * real `core.sync.FenceConflictResolution` enum.
 */
class FenceConflictFormTest {

    @Test fun rejects_a_take_over_attempt_without_acknowledgement() {
        val result = resolveFenceConflict(FenceConflictResolution.TAKE_OVER, false)
        assertTrue(result is ResolveFenceConflictResult.Rejected)
        assertTrue((result as ResolveFenceConflictResult.Rejected).reason.contains("locked out"))
    }

    @Test fun succeeds_with_take_over_once_acknowledged() {
        assertEquals(
            ResolveFenceConflictResult.Resolved(FenceConflictResolution.TAKE_OVER),
            resolveFenceConflict(FenceConflictResolution.TAKE_OVER, true),
        )
    }

    @Test fun discard_locally_never_requires_acknowledgement() {
        assertEquals(
            ResolveFenceConflictResult.Resolved(FenceConflictResolution.DISCARD_LOCALLY),
            resolveFenceConflict(FenceConflictResolution.DISCARD_LOCALLY, false),
        )
        assertEquals(
            ResolveFenceConflictResult.Resolved(FenceConflictResolution.DISCARD_LOCALLY),
            resolveFenceConflict(FenceConflictResolution.DISCARD_LOCALLY, true),
        )
    }
}
