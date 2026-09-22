package com.kencric.scoring.core.model

/** live-scoring.md §7.1. Minimal structure only -- the aggregation
 * formulas (§7.2) are TASK-0019's scope, not implemented here. This task
 * (TASK-0017) needs only the shape, for V2-V4/V6 validation. */
enum class RunEventOrigin {
    OFF_BAT,
    BYE,
    LEG_BYE,
    WIDE,
    NO_BALL_PENALTY,
    NO_BALL_BAT,
    NO_BALL_BYE,
    NO_BALL_LEG_BYE,
    PENALTY,
}

/** `method`, not `origin`, drives strike-rotation eligibility (§14, not
 * this task's scope) -- kept distinct per the spec's own emphasis. */
enum class RunEventMethod {
    RUN,
    BOUNDARY,
    OVERTHROW,
    AUTOMATIC,
}

data class RunEvent(
    val origin: RunEventOrigin,
    val value: Int,
    val method: RunEventMethod,
    /** Only meaningful when origin == PENALTY (§7.1); null otherwise. */
    val awardedToTeamId: String? = null,
)

/**
 * live-scoring.md §7.3's valid (origin, method) table. Any pairing not
 * covered here fails V2. NO_BALL_PENALTY/PENALTY are AUTOMATIC-only;
 * every other origin (including WIDE, per §7.3's own clarifying note)
 * allows RUN/BOUNDARY/OVERTHROW.
 */
fun isValidOriginMethodPair(origin: RunEventOrigin, method: RunEventMethod): Boolean =
    when (origin) {
        RunEventOrigin.NO_BALL_PENALTY, RunEventOrigin.PENALTY ->
            method == RunEventMethod.AUTOMATIC
        else ->
            method == RunEventMethod.RUN ||
                method == RunEventMethod.BOUNDARY ||
                method == RunEventMethod.OVERTHROW
    }
