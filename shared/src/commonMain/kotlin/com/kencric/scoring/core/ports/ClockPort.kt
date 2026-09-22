package com.kencric.scoring.core.ports

/**
 * Reads the current time. The only sanctioned way commonMain code learns
 * "now" -- never a direct system-clock call. live-scoring.md §1.1:
 * determinism requires no I/O, no clock, no RNG inside the pipeline
 * itself; every platform's port adapter (androidMain/jsMain/jvmMain)
 * supplies the real clock.
 */
interface ClockPort {
    /** Epoch milliseconds, UTC. */
    fun nowEpochMillis(): Long
}
