package com.kencric.scoring.core.model

enum class CreaseEnd { STRIKER, NON_STRIKER }

/** live-scoring.md §9.2. Required fields listed before defaulted ones,
 * so positional construction stays safe -- every call site in this
 * codebase currently uses named arguments regardless. */
data class WicketDetail(
    val mode: DismissalMode,
    val outBatterId: String,
    val endVacated: CreaseEnd,
    val fielderIds: List<String> = emptyList(),
    /** Required (non-null) only for RUN_OUT, per §9.2. Not enforced as a
     * type-level constraint here -- V-rule enforcement, not the type
     * system, is this task's mechanism (matching every other
     * cross-field rule in this model). */
    val crossedBeforeDismissal: Boolean? = null,
    /** Null only when the innings ends on this wicket (§9.2). */
    val incomingBatterId: String? = null,
)
