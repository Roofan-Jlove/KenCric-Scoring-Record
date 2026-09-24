package com.kencric.scoring.ui.screens.ux08toss

/**
 * TASK-0052: `ux-specification.md UX-08`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-08-toss/tossForm.ts` (`TASK-0051`)
 * -- same contract-only scope note as `TASK-0041`/`0046`/`0048`/`0050`:
 * no Android SDK/Gradle/Kotlin toolchain exists in this session, placed
 * in `shared/commonMain` since this logic touches no Android API
 * surface at all.
 *
 * CITATION NOTE: `UX-08`'s Trace line cites `FR-023`, the SRS's own
 * renumbered `FR-023` ("Toss capture and innings order") -- not
 * discovery's own, unrelated `FR-023` ("Configure ball type/brand," a
 * V2 item). See this task's own backlog entry for the full trail.
 */

enum class TossWinner { A, B }
enum class TossDecision { BAT, BOWL }

data class TossState(
    val winner: TossWinner? = null,
    val decision: TossDecision? = null,
    val confirmed: Boolean = false,
)

fun initialTossState(): TossState = TossState()

/** UX-08's own Validation: "Both fields required before Confirm enables." */
fun canConfirm(state: TossState): Boolean =
    state.winner != null && state.decision != null && !state.confirmed

sealed class ConfirmResult {
    data class Confirmed(val state: TossState) : ConfirmResult()
    data class Rejected(val reason: String) : ConfirmResult()
}

fun confirmToss(state: TossState): ConfirmResult {
    if (state.winner == null || state.decision == null) {
        return ConfirmResult.Rejected("Select both toss winner and decision before confirming")
    }
    if (state.confirmed) {
        return ConfirmResult.Rejected("Toss already confirmed")
    }
    return ConfirmResult.Confirmed(state.copy(confirmed = true))
}

data class InningsOrder(val battingFirst: TossWinner, val chasingSide: TossWinner)

private fun otherSide(side: TossWinner): TossWinner = if (side == TossWinner.A) TossWinner.B else TossWinner.A

/**
 * `N-B2`: "Given a toss recorded as 'Team A elects to bat,' when
 * confirmed, then the chasing-innings side is set to Team B."
 */
fun deriveInningsOrder(winner: TossWinner, decision: TossDecision): InningsOrder {
    val battingFirst = if (decision == TossDecision.BAT) winner else otherSide(winner)
    return InningsOrder(battingFirst = battingFirst, chasingSide = otherSide(battingFirst))
}

enum class EditAttemptResult { ALLOWED, REQUIRES_AMENDMENT }

/**
 * `isLocked` is caller-supplied -- this screen has no visibility into
 * `match_events` (whether a first ball has actually been recorded), the
 * same boundary `TASK-0044`/`0045` already flagged for their own locked
 * states.
 */
fun attemptEdit(isLocked: Boolean): EditAttemptResult =
    if (isLocked) EditAttemptResult.REQUIRES_AMENDMENT else EditAttemptResult.ALLOWED

sealed class AmendResult {
    data class Amended(val state: TossState) : AmendResult()
    data class Rejected(val reason: String) : AmendResult()
}

/** UX-08's own Error handling: the amendment path requires a mandatory reason, not a flat refusal. */
fun amendToss(newWinner: TossWinner, newDecision: TossDecision, reason: String): AmendResult {
    if (reason.trim().isEmpty()) {
        return AmendResult.Rejected("An amendment requires a reason")
    }
    return AmendResult.Amended(TossState(winner = newWinner, decision = newDecision, confirmed = true))
}
