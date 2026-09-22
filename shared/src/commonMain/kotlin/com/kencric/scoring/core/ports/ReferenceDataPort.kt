package com.kencric.scoring.core.ports

/**
 * Reads pinned reference-data (playing-conditions profiles, DLS tables)
 * by kind and version -- never a live/unpinned lookup from within the
 * pipeline. ADR-11: reference data is versioned and pinned per match at
 * creation; a match's applicable rules must not silently change under it.
 *
 * Payload is a plain string (already-serialized), same deferred-typing
 * reasoning as EventLogPort -- the CFG-REG resolver's actual Kotlin
 * shape is cricket-rules-reference.md §35's domain, not yet modeled.
 */
interface ReferenceDataPort {
    /**
     * The serialized payload for one (kind, version) reference-data row,
     * or null if this device has no cached copy of it.
     */
    suspend fun get(kind: String, version: Int): String?
}
