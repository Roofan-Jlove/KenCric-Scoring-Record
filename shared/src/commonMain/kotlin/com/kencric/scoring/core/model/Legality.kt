package com.kencric.scoring.core.model

/** live-scoring.md §3: always scorer-declared, never inferred by the engine. */
enum class Legality {
    LEGAL,
    WIDE,
    NO_BALL,
    DEAD_BALL,
}
