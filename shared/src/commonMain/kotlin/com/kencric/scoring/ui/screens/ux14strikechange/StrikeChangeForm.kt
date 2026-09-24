package com.kencric.scoring.ui.screens.ux14strikechange

/**
 * TASK-0064: `ux-specification.md UX-14`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-14-strike-change/
 * strikeChangeForm.ts` (`TASK-0063`) -- same contract-only scope note
 * as every earlier screen this session: no Android SDK/Gradle/Kotlin
 * toolchain exists, placed in `shared/commonMain` since this logic
 * touches no Android API surface at all.
 *
 * `core.pipeline.StrikeResolver`'s own "HONEST SCOPE NOTE" flags `§14.5`
 * (manual override) as not implemented anywhere in the pipeline -- this
 * is the first real coverage of it, not a re-mirror of already-tested
 * shared logic. See `TASK-0063`'s own file for the flagged, unresolved
 * tension between `UX-14`'s "no not-out batters to swap to" error case
 * and the strict-swap model implemented here.
 */

data class StrikePositions(val strikerId: String, val nonStrikerId: String)

enum class StrikeChangeState { AUTO, PENDING_OVERRIDE, OVERRIDDEN }

data class StrikeChangeFormState(
    val status: StrikeChangeState,
    val positions: StrikePositions,
    val reason: String,
)

fun initialStrikeChangeFormState(positions: StrikePositions): StrikeChangeFormState =
    StrikeChangeFormState(status = StrikeChangeState.AUTO, positions = positions, reason = "")

/** UX-14's own Actions: "Tap 'Swap ends'" -- opens the reason field, does not apply anything yet. */
fun toggleSwap(state: StrikeChangeFormState): StrikeChangeFormState = state.copy(status = StrikeChangeState.PENDING_OVERRIDE)

fun cancelSwap(state: StrikeChangeFormState): StrikeChangeFormState = state.copy(status = StrikeChangeState.AUTO, reason = "")

sealed class ConfirmOverrideResult {
    data class Overridden(val state: StrikeChangeFormState) : ConfirmOverrideResult()
    data class Rejected(val reason: String) : ConfirmOverrideResult()
}

/** `§14.5`: "requires a non-empty reason." Swaps the current pair -- `newStrikerId` is the current non-striker, matching `CMD-OVERRIDE-STRIKER`'s own shape. */
fun confirmOverride(state: StrikeChangeFormState, reason: String): ConfirmOverrideResult {
    if (reason.trim().isEmpty()) {
        return ConfirmOverrideResult.Rejected("An override requires a reason")
    }
    val swapped = StrikePositions(strikerId = state.positions.nonStrikerId, nonStrikerId = state.positions.strikerId)
    return ConfirmOverrideResult.Overridden(
        StrikeChangeFormState(status = StrikeChangeState.OVERRIDDEN, positions = swapped, reason = reason.trim())
    )
}

/** `§14.5`: "never 'sticky' beyond the one delivery it targets." */
fun resetToAutoForNextDelivery(state: StrikeChangeFormState, autoDerivedPositions: StrikePositions): StrikeChangeFormState =
    StrikeChangeFormState(status = StrikeChangeState.AUTO, positions = autoDerivedPositions, reason = "")
