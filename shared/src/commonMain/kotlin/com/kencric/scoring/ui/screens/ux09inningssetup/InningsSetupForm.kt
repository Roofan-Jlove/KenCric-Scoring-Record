package com.kencric.scoring.ui.screens.ux09inningssetup

/**
 * TASK-0054: `ux-specification.md UX-09`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-09-innings-setup/
 * inningsSetupForm.ts` (`TASK-0053`) -- same contract-only scope note as
 * `TASK-0041`/`0046`/`0048`/`0050`/`0052`: no Android SDK/Gradle/Kotlin
 * toolchain exists in this session, placed in `shared/commonMain` since
 * this logic touches no Android API surface at all.
 *
 * CITATION NOTE: `UX-09`'s Trace line cites `FR-042`, the SRS's own
 * renumbered `FR-042` ("Set the opening striker, non-striker and
 * bowler") -- not discovery's own, unrelated `FR-042` ("Lock lineup at
 * deadline"). See this task's own backlog entry for the full trail.
 */

data class Player(val id: String, val name: String)

data class InningsSetupState(
    val strikerId: String? = null,
    val nonStrikerId: String? = null,
    val bowlerId: String? = null,
)

fun initialInningsSetupState(): InningsSetupState = InningsSetupState()

sealed class SelectResult {
    data class Selected(val state: InningsSetupState) : SelectResult()
    data class Rejected(val reason: String) : SelectResult()
}

/**
 * UX-09's own Error handling: "Selecting the same person as striker and
 * non-striker is blocked inline." Also enforces Validation's "batters
 * must come from the batting side's XI."
 */
fun selectStriker(
    state: InningsSetupState,
    playerId: String,
    battingXi: List<Player>,
    battingSideName: String,
): SelectResult {
    if (battingXi.none { it.id == playerId }) {
        return SelectResult.Rejected("The striker must be from $battingSideName's XI")
    }
    if (state.nonStrikerId == playerId) {
        return SelectResult.Rejected("This player is already selected as non-striker")
    }
    return SelectResult.Selected(state.copy(strikerId = playerId))
}

fun selectNonStriker(
    state: InningsSetupState,
    playerId: String,
    battingXi: List<Player>,
    battingSideName: String,
): SelectResult {
    if (battingXi.none { it.id == playerId }) {
        return SelectResult.Rejected("The non-striker must be from $battingSideName's XI")
    }
    if (state.strikerId == playerId) {
        return SelectResult.Rejected("This player is already selected as striker")
    }
    return SelectResult.Selected(state.copy(nonStrikerId = playerId))
}

/** UX-09's own Error handling: "picking a bowler from the wrong side is blocked with an explanation naming the correct side." */
fun selectBowler(
    state: InningsSetupState,
    playerId: String,
    fieldingXi: List<Player>,
    fieldingSideName: String,
): SelectResult {
    if (fieldingXi.none { it.id == playerId }) {
        return SelectResult.Rejected("The opening bowler must be from $fieldingSideName's XI")
    }
    return SelectResult.Selected(state.copy(bowlerId = playerId))
}

/** UX-09's own Actions: "Swap striker/non-striker." */
fun swapEnds(state: InningsSetupState): InningsSetupState =
    state.copy(strikerId = state.nonStrikerId, nonStrikerId = state.strikerId)

/**
 * `selectStriker`/`selectNonStriker` structurally prevent the same
 * player ever occupying both roles, so this distinctness check is a
 * defensive confirmation of that invariant, not a reachable failure path.
 */
fun canConfirm(state: InningsSetupState): Boolean {
    if (state.strikerId == null || state.nonStrikerId == null || state.bowlerId == null) return false
    return state.strikerId != state.nonStrikerId
}

sealed class ConfirmResult {
    data class Started(val state: InningsSetupState) : ConfirmResult()
    data class Rejected(val reason: String) : ConfirmResult()
}

fun confirmAndStart(state: InningsSetupState): ConfirmResult {
    if (!canConfirm(state)) {
        return ConfirmResult.Rejected("Select striker, non-striker, and opening bowler before starting")
    }
    return ConfirmResult.Started(state)
}
