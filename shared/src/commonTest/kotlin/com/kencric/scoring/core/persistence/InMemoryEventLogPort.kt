package com.kencric.scoring.core.persistence

import com.kencric.scoring.core.ports.EventLogPort

/**
 * A test double simulating "durable" storage as a backing
 * `MutableList` external to this instance. Constructing a NEW
 * `InMemoryEventLogPort` against the SAME [backingStore] simulates a
 * process restart re-reading from durable storage -- this is how
 * `DurableEventLogWriterTest`'s crash-simulation test proves the
 * durability contract without a real SQLite/IndexedDB adapter. Neither
 * exists in this backlog yet: no `apps/android` or `apps/web` project
 * has been bootstrapped, and this environment has no Android SDK or
 * browser runtime to build or run one against -- `TASK-0033`'s own real
 * platform-adapter scope is deferred to a follow-up task once those are
 * bootstrapped, per explicit direction (the same "contract-only, prove
 * it with a fake" scoping `TASK-0013`/`TASK-0016` used for other
 * toolchain gaps).
 */
class InMemoryEventLogPort(private val backingStore: MutableList<String>) : EventLogPort {
    override suspend fun append(serializedEvent: String) {
        backingStore.add(serializedEvent)
    }

    override suspend fun readAll(): List<String> = backingStore.toList()
}
