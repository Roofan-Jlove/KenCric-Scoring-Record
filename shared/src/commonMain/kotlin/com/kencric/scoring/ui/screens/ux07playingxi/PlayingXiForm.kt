package com.kencric.scoring.ui.screens.ux07playingxi

/**
 * TASK-0050: `ux-specification.md UX-07`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-07-playing-xi/playingXiForm.ts`
 * (`TASK-0049`) -- same contract-only scope note as `TASK-0041`/`0046`/
 * `0048`: no Android SDK/Gradle/Kotlin toolchain exists in this session,
 * placed in `shared/commonMain` since this logic touches no Android API
 * surface at all.
 */

data class Player(val id: String, val name: String, val isAdHoc: Boolean)

data class SideXiState(
    val squad: List<Player>,
    val selectedIds: List<String> = emptyList(),
    val captainId: String? = null,
    val keeperId: String? = null,
)

data class PlayingXiState(val sideA: SideXiState, val sideB: SideXiState)

fun initialSideXiState(squad: List<Player>): SideXiState = SideXiState(squad = squad)

sealed class ToggleResult {
    data class Toggled(val state: SideXiState) : ToggleResult()
    data class Blocked(val reason: String) : ToggleResult()
}

/**
 * UX-07's own Error handling: "Attempting an over-count selection is
 * blocked at the moment of the extra tap ('XI is full -- remove someone
 * first'), not after Continue is pressed."
 *
 * Removing a player who was holding the captain/keeper role also clears
 * that role -- the same inferred invariant `TASK-0049`'s TypeScript
 * version documents.
 */
fun togglePlayer(state: SideXiState, playerId: String, requiredXiSize: Int): ToggleResult {
    val isSelected = state.selectedIds.contains(playerId)
    if (isSelected) {
        return ToggleResult.Toggled(
            state.copy(
                selectedIds = state.selectedIds.filter { it != playerId },
                captainId = if (state.captainId == playerId) null else state.captainId,
                keeperId = if (state.keeperId == playerId) null else state.keeperId,
            )
        )
    }
    if (state.selectedIds.size >= requiredXiSize) {
        return ToggleResult.Blocked("XI is full — remove someone first")
    }
    return ToggleResult.Toggled(state.copy(selectedIds = state.selectedIds + playerId))
}

sealed class SetRoleResult {
    data class Set(val state: SideXiState) : SetRoleResult()
    data class Rejected(val reason: String) : SetRoleResult()
}

/**
 * `I-C2` ("two players both marked as captain for one side... rejected")
 * is satisfied structurally, not by a runtime check: `captainId` is a
 * single nullable field, not a list, so "two captains" has no
 * representation in this state shape at all.
 */
fun setCaptain(state: SideXiState, playerId: String): SetRoleResult {
    if (!state.selectedIds.contains(playerId)) {
        return SetRoleResult.Rejected("Captain must be selected in the XI")
    }
    return SetRoleResult.Set(state.copy(captainId = playerId))
}

fun setKeeper(state: SideXiState, playerId: String): SetRoleResult {
    if (!state.selectedIds.contains(playerId)) {
        return SetRoleResult.Rejected("Wicket-keeper must be selected in the XI")
    }
    return SetRoleResult.Set(state.copy(keeperId = playerId))
}

sealed class AddAdHocResult {
    data class Added(val state: SideXiState) : AddAdHocResult()
    data class Blocked(val reason: String) : AddAdHocResult()
}

/** UX-07's own Actions: "Add an ad-hoc player mid-selection" -- adds to the squad and immediately into the XI. */
fun addAdHocPlayer(state: SideXiState, name: String, requiredXiSize: Int, newPlayerId: String): AddAdHocResult {
    val player = Player(id = newPlayerId, name = name, isAdHoc = true)
    val withPlayer = state.copy(squad = state.squad + player)
    return when (val toggled = togglePlayer(withPlayer, newPlayerId, requiredXiSize)) {
        is ToggleResult.Blocked -> AddAdHocResult.Blocked(toggled.reason)
        is ToggleResult.Toggled -> AddAdHocResult.Added(toggled.state)
    }
}

enum class Side { A, B }

enum class SideValidationIssueKind { COUNT, CAPTAIN, KEEPER }

data class SideValidationIssue(val side: Side, val issue: SideValidationIssueKind, val message: String)

/** Drives UX-07's own Error handling: "a Continue attempt with no keeper marked shows an inline error...". */
fun sideValidationIssues(state: SideXiState, side: Side, requiredXiSize: Int): List<SideValidationIssue> {
    val issues = mutableListOf<SideValidationIssue>()
    if (state.selectedIds.size != requiredXiSize) {
        issues.add(
            SideValidationIssue(
                side,
                SideValidationIssueKind.COUNT,
                "Team ${side.name}: ${state.selectedIds.size} of $requiredXiSize selected",
            )
        )
    }
    if (state.captainId == null) {
        issues.add(SideValidationIssue(side, SideValidationIssueKind.CAPTAIN, "Team ${side.name}: captain required"))
    }
    if (state.keeperId == null) {
        issues.add(SideValidationIssue(side, SideValidationIssueKind.KEEPER, "Team ${side.name}: wicket-keeper required"))
    }
    return issues
}

/** `N-C1`/`B-C1`: exact count, exactly one captain, exactly one keeper. */
fun sideIsValid(state: SideXiState, requiredXiSize: Int): Boolean =
    state.selectedIds.size == requiredXiSize && state.captainId != null && state.keeperId != null

/** `I-C1`: "the same `player_id` selected in both sides' XIs... identifying that specific player id." */
fun findDuplicatePlayerId(state: PlayingXiState): String? {
    val sideASet = state.sideA.selectedIds.toSet()
    return state.sideB.selectedIds.firstOrNull { sideASet.contains(it) }
}

fun canContinue(state: PlayingXiState, requiredXiSize: Int): Boolean {
    if (!sideIsValid(state.sideA, requiredXiSize)) return false
    if (!sideIsValid(state.sideB, requiredXiSize)) return false
    return findDuplicatePlayerId(state) == null
}
