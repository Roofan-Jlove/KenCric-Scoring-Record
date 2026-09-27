/**
 * TASK-0085: `ux-specification.md UX-25` -- Conflict Resolution,
 * fence-conflict-resolution layer, **P1 half only**.
 *
 * MAJOR SCOPING NOTE: `UX-25`'s own Purpose text explicitly tags its two
 * concerns differently -- "dual-scorer divergences (V2)" vs. "device-
 * fence conflicts (P1, one scorer/multiple devices)." Per `FA-8` (a
 * requirement not explicitly Must/P1 is not MVP scope), this module
 * covers the P1 fence-conflict half only; the V2 divergence half is
 * deferred to this backlog's own `§6.3`.
 *
 * CITATION NOTE: every citation in `UX-25`'s own Trace line
 * (`FR-107…111`, `BR-008`, `MINV-14`, `SYNC-011…014`) belongs
 * exclusively to the deferred V2 divergence half -- none of them cover
 * this module's actual scope. The real authority for the fence-
 * conflict half is `offline-first-specification.md §11.1`, the same
 * source `shared/`'s existing `core/sync/WriterFenceConflict.kt`
 * (`TASK-0037`) already cites.
 *
 * `FenceConflictResolution` mirrors that file's own enum field-for-
 * field -- genuine reuse, not reinvention.
 */

export type FenceConflictResolution = "TAKE_OVER" | "DISCARD_LOCALLY";

export type ResolveFenceConflictResult =
  | { outcome: "resolved"; resolution: FenceConflictResolution }
  | { outcome: "rejected"; reason: string };

/**
 * `UX-25`'s own Validation (fence half): "taking over a fence requires
 * explicit acknowledgement that the other device will be locked out."
 * No such gate applies to `DISCARD_LOCALLY` -- cancelling and keeping
 * the original device active locks nobody out.
 */
export function resolveFenceConflict(
  resolution: FenceConflictResolution,
  hasAcknowledgedLockout: boolean,
): ResolveFenceConflictResult {
  if (resolution === "TAKE_OVER" && !hasAcknowledgedLockout) {
    return { outcome: "rejected", reason: "You must acknowledge that the other device will be locked out before taking over" };
  }
  return { outcome: "resolved", resolution };
}
