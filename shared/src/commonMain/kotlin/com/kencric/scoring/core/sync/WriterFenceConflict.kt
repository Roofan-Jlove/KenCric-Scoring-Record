package com.kencric.scoring.core.sync

/**
 * offline-first-specification.md §11.1: the losing device's rejected,
 * still-locally-held events are presented with EXACTLY these two
 * explicit options -- "no third, automatic option exists... a fence
 * conflict is a workflow question a human must answer, never a
 * technical merge decision." Modeled as an enum specifically so there
 * is no way to construct a third value.
 */
enum class FenceConflictResolution { TAKE_OVER, DISCARD_LOCALLY }

/**
 * §7.6: "a device caches its last-known [fence] value locally." One
 * entry per stream this device writes to.
 *
 * HONEST SCOPE NOTE: the actual lease-acquisition/renewal handshake
 * with the server (§7.6, confirming or renewing the fence) is not
 * modeled here -- this type only records the LOCAL bookkeeping
 * consequence of §11.1 option 1 ("take over") once a new fence value
 * is already known, which is as far as this task's own scope (fence
 * enforcement/detection, not the full renewal protocol) goes.
 */
data class FenceCache(val fenceByStream: Map<String, String> = emptyMap())

/** §11.1 option 1's local bookkeeping: records the newly (re-)acquired fence value for [streamId]. */
fun takeOverFence(cache: FenceCache, streamId: String, newFence: String): FenceCache =
    cache.copy(fenceByStream = cache.fenceByStream + (streamId to newFence))
