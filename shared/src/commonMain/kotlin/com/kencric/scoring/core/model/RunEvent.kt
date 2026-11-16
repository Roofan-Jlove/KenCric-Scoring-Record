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
 * WIDE allows RUN/BOUNDARY/OVERTHROW *plus* AUTOMATIC (a real
 * correction -- §7.3's own table originally omitted AUTOMATIC for
 * WIDE, contradicting §7.6's own worked example of the mandatory
 * 1-run wide: "RunEvent(origin=WIDE, value=1, method=AUTOMATIC)",
 * which ExtrasDecomposer.kt's own wideRunEvents() already builds
 * correctly). Every other origin allows RUN/BOUNDARY/OVERTHROW only.
 */
fun isValidOriginMethodPair(origin: RunEventOrigin, method: RunEventMethod): Boolean =
    when (origin) {
        RunEventOrigin.NO_BALL_PENALTY, RunEventOrigin.PENALTY ->
            method == RunEventMethod.AUTOMATIC
        RunEventOrigin.WIDE ->
            method == RunEventMethod.RUN ||
                method == RunEventMethod.BOUNDARY ||
                method == RunEventMethod.OVERTHROW ||
                method == RunEventMethod.AUTOMATIC
        else ->
            method == RunEventMethod.RUN ||
                method == RunEventMethod.BOUNDARY ||
                method == RunEventMethod.OVERTHROW
    }
