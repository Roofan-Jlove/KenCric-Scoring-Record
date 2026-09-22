package com.kencric.scoring.core.model

/**
 * live-scoring.md §9.1/§9.2. NOTE: §9.2's own prose says "one of the 11
 * dismissal modes," but only 10 are ever defined anywhere in the corpus
 * -- confirmed independently in §9.1's validity matrix, §9.4's
 * bowler-credit table, and data-specification.md §7.5's wickets.mode
 * enum (already implemented, TASK-0010). This is a known, already-logged
 * spec defect (adversarial-verification-report.md AVF-SE-01), not
 * resolved via RCR yet -- 10 values used here, matching every other
 * place this enum is actually enumerated, not the "11" in §9.2's prose.
 */
enum class DismissalMode {
    BOWLED,
    CAUGHT,
    LBW,
    RUN_OUT,
    STUMPED,
    HIT_WICKET,
    OBSTRUCTING_THE_FIELD,
    HIT_BALL_TWICE,
    TIMED_OUT,
    RETIRED_OUT,
}

/**
 * live-scoring.md §9.3: dismissal modes physically incompatible with any
 * runs having been scored -- V6 rejects a wicket in this set with
 * non-zero RunEvents.
 */
val ALWAYS_ZERO_RUNS_MODES: Set<DismissalMode> = setOf(
    DismissalMode.BOWLED,
    DismissalMode.CAUGHT,
    DismissalMode.LBW,
    DismissalMode.STUMPED,
    DismissalMode.HIT_BALL_TWICE,
)

/**
 * live-scoring.md §9.1: modes that require wicket.fielderIds to be
 * non-empty (V7) -- CAUGHT always; RUN_OUT/STUMPED/OBSTRUCTING_THE_FIELD
 * only when a fielder effected it, which this task cannot distinguish
 * from the mode alone -- see the V7 implementation note in
 * DeliveryValidator.kt for the resulting, deliberately conservative
 * scope reduction.
 */
val FIELDER_REQUIRED_MODES: Set<DismissalMode> = setOf(
    DismissalMode.CAUGHT,
)

/**
 * live-scoring.md §9.4: wicket.creditsBowler is a pure function of mode,
 * never independently set. Verified against every §21.7 case (C31-C44)
 * by hand before being written here. Also closes a gap flagged during
 * TASK-0010: data-specification.md §7.5's wickets.credits_bowler column
 * had no CHECK constraint tying it to mode, because this mapping wasn't
 * confirmed at the time -- see the follow-up migration that adds it now.
 */
val BOWLER_CREDITED_MODES: Set<DismissalMode> = setOf(
    DismissalMode.BOWLED,
    DismissalMode.CAUGHT,
    DismissalMode.LBW,
    DismissalMode.STUMPED,
    DismissalMode.HIT_WICKET,
)

fun creditsBowler(mode: DismissalMode): Boolean = mode in BOWLER_CREDITED_MODES

/**
 * live-scoring.md §9.1's determinism table, restated as a function of
 * (legality, isFreeHit) -> the valid dismissal-mode set for that
 * context. Pre-delivery (mankad) and not-tied-to-a-delivery
 * (TIMED_OUT/RETIRED_OUT) contexts are out of scope here -- V5 only
 * ever runs against an actual DeliveryInput, which always has a
 * Legality value; those two rows of §9.1's table apply to event shapes
 * that are not a DeliveryInput.wicket at all (§9.6/§9.7), so they are
 * never reachable through this function.
 */
fun validDismissalModesFor(legality: Legality, isFreeHit: Boolean): Set<DismissalMode> = when {
    legality == Legality.LEGAL && isFreeHit -> setOf(
        DismissalMode.RUN_OUT,
        DismissalMode.OBSTRUCTING_THE_FIELD,
        DismissalMode.HIT_BALL_TWICE,
    )
    legality == Legality.LEGAL -> setOf(
        DismissalMode.BOWLED,
        DismissalMode.CAUGHT,
        DismissalMode.LBW,
        DismissalMode.RUN_OUT,
        DismissalMode.STUMPED,
        DismissalMode.HIT_WICKET,
        DismissalMode.OBSTRUCTING_THE_FIELD,
        DismissalMode.HIT_BALL_TWICE,
    )
    legality == Legality.NO_BALL -> setOf(
        DismissalMode.RUN_OUT,
        DismissalMode.OBSTRUCTING_THE_FIELD,
        DismissalMode.HIT_BALL_TWICE,
    )
    legality == Legality.WIDE -> setOf(
        DismissalMode.RUN_OUT,
        DismissalMode.STUMPED,
        DismissalMode.OBSTRUCTING_THE_FIELD,
        DismissalMode.HIT_BALL_TWICE,
        // HIT_WICKET off a wide is [OPEN] in §9.1 -- this spec's stated
        // default is NOT offered, pending accredited-scorer ratification.
        // Deliberately excluded here, matching that stated default.
    )
    legality == Legality.DEAD_BALL -> emptySet()
    else -> emptySet()
}
