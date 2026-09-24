package com.kencric.scoring.ui.screens.ux15bowlerchange

/**
 * TASK-0066: `ux-specification.md UX-15`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-15-bowler-change/
 * bowlerChangeForm.ts` (`TASK-0065`) -- same contract-only scope note
 * as every earlier screen this session: no Android SDK/Gradle/Kotlin
 * toolchain exists, placed in `shared/commonMain` since this logic
 * touches no Android API surface at all.
 *
 * `live-scoring.md §4`'s guardrail preconditions (`BR-027`/`BR-028`)
 * have been explicitly out of scope for every task in this backlog
 * since `TASK-0017` -- `TASK-0065`/`0066` are the first real
 * implementation of them, not a reuse of existing `shared/` logic.
 */

data class BowlerCandidate(
    val id: String,
    val name: String,
    val legalBallsBowled: Int,
    val runsCharged: Int,
    val wickets: Int,
    val maidens: Int,
)

enum class GuardrailRule { CONSECUTIVE_OVER, OVER_LIMIT }

/**
 * `§4` rule 5: "not the immediately preceding over's bowler (`BR-027`)
 * and not already at `bowlerOverCap` (`BR-028`)." `B-D3`'s exact
 * boundary: `bowlerOverCap − 1` overs bowled is accepted, exactly
 * `bowlerOverCap` is blocked.
 */
fun guardrailBlocksFor(
    candidate: BowlerCandidate,
    previousOverBowlerId: String?,
    bowlerOverCap: Int?,
    ballsPerOver: Int,
): List<GuardrailRule> {
    val blocks = mutableListOf<GuardrailRule>()
    if (previousOverBowlerId != null && candidate.id == previousOverBowlerId) {
        blocks.add(GuardrailRule.CONSECUTIVE_OVER)
    }
    if (bowlerOverCap != null) {
        val oversBowled = candidate.legalBallsBowled.toDouble() / ballsPerOver
        if (oversBowled >= bowlerOverCap) {
            blocks.add(GuardrailRule.OVER_LIMIT)
        }
    }
    return blocks
}

fun isGuardrailBlocked(candidate: BowlerCandidate, previousOverBowlerId: String?, bowlerOverCap: Int?, ballsPerOver: Int): Boolean =
    guardrailBlocksFor(candidate, previousOverBowlerId, bowlerOverCap, ballsPerOver).isNotEmpty()

/** UX-15's own Error-handling text: the specific rule stated plainly. */
fun guardrailMessage(rule: GuardrailRule): String = when (rule) {
    GuardrailRule.CONSECUTIVE_OVER -> "Same bowler can't bowl consecutive overs"
    GuardrailRule.OVER_LIMIT -> "This bowler has already reached the maximum overs allowed"
}

sealed class ConfirmResult {
    data class Confirmed(val candidateId: String) : ConfirmResult()
    data class Rejected(val reason: String) : ConfirmResult()
}

/** `V10`: "overrideReason is non-empty whenever a guardrail override is in effect." */
fun confirmSelection(candidate: BowlerCandidate, blocks: List<GuardrailRule>, overrideReason: String): ConfirmResult {
    if (blocks.isNotEmpty() && overrideReason.trim().isEmpty()) {
        return ConfirmResult.Rejected("An override requires a reason")
    }
    return ConfirmResult.Confirmed(candidate.id)
}
