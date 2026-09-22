package com.kencric.scoring.core.ports

/**
 * Generates identifiers. The only sanctioned way commonMain code creates
 * a new id -- never a direct UUID-library call. Same determinism
 * boundary as ClockPort (live-scoring.md §1.1); every platform's port
 * adapter supplies the real generator.
 */
interface IdPort {
    /** A new, globally-unique identifier, as its canonical string form. */
    fun newId(): String
}
