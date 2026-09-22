package com.kencric.scoring.core.ports

/**
 * Reads and appends to the local event log. Each platform (androidMain:
 * SQLite/PowerSync; jsMain: IndexedDB/PowerSync-web; jvmMain: direct
 * Postgres) supplies the concrete adapter -- commonMain never touches
 * storage directly (repository-structure.md §5's ports/adapters
 * explanation).
 *
 * Payloads are plain strings (already-serialized), not a typed domain
 * event, deliberately: the domain event model (data-specification.md
 * §6.1's match_events shape, e.g. EVT-DELIVERY-RECORDED) is TASK-0017+'s
 * scope, not yet defined as a Kotlin type. This interface's shape may
 * need revisiting once that model exists -- not assumed settled here.
 */
interface EventLogPort {
    /** Appends one event's already-serialized form to the local log. */
    suspend fun append(serializedEvent: String)

    /** Reads every event currently in the local log, in log order. */
    suspend fun readAll(): List<String>
}
