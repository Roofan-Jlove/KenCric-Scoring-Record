package com.kencric.scoring.ui.screens.ux25conflictresolution

import com.kencric.scoring.core.sync.FenceConflictResolution

/**
 * TASK-0086: `ux-specification.md UX-25`'s own logic, **P1 fence-
 * conflict half only** (the V2 dual-scorer-divergence half is deferred,
 * see `TASK-0085`'s own file). Unlike the web TS mirror (`TASK-0085`,
 * which necessarily redefines `FenceConflictResolution` since
 * TypeScript cannot import Kotlin types), this file **genuinely imports
 * the real `core.sync.FenceConflictResolution`** directly -- the same
 * reuse pattern `TASK-0060`/`0070`/`0076`/`0080`/`0082`/`0084`
 * established.
 */

sealed class ResolveFenceConflictResult {
    data class Resolved(val resolution: FenceConflictResolution) : ResolveFenceConflictResult()
    data class Rejected(val reason: String) : ResolveFenceConflictResult()
}

/**
 * `UX-25`'s own Validation (fence half): "taking over a fence requires
 * explicit acknowledgement that the other device will be locked out."
 * No such gate applies to `DISCARD_LOCALLY`.
 */
fun resolveFenceConflict(resolution: FenceConflictResolution, hasAcknowledgedLockout: Boolean): ResolveFenceConflictResult {
    if (resolution == FenceConflictResolution.TAKE_OVER && !hasAcknowledgedLockout) {
        return ResolveFenceConflictResult.Rejected("You must acknowledge that the other device will be locked out before taking over")
    }
    return ResolveFenceConflictResult.Resolved(resolution)
}
