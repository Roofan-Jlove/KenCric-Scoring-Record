package com.kencric.scoring.ui.screens.ux06teamselection

/**
 * TASK-0048: `ux-specification.md UX-06`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-06-team-selection/
 * teamSelectionForm.ts` (`TASK-0047`) -- same contract-only scope note
 * as `TASK-0041`/`0046`: no Android SDK/Gradle/Kotlin toolchain exists
 * in this session, placed in `shared/commonMain` since this logic
 * touches no Android API surface at all.
 */

data class Team(val id: String, val name: String, val isAdHoc: Boolean)

data class Player(val id: String, val name: String, val isAdHoc: Boolean)

data class TeamSelectionState(
    val teamA: Team? = null,
    val teamB: Team? = null,
    val squadA: List<Player> = emptyList(),
    val squadB: List<Player> = emptyList(),
)

fun initialTeamSelectionState(): TeamSelectionState = TeamSelectionState()

/** UX-06's own Error handling: "Selecting the same team on both sides is blocked immediately... not deferred to Continue." */
fun teamsAreDistinct(state: TeamSelectionState): Boolean {
    val a = state.teamA
    val b = state.teamB
    if (a == null || b == null) return true
    return a.id != b.id
}

enum class Side { A, B }

sealed class SelectTeamResult {
    data class Selected(val state: TeamSelectionState) : SelectTeamResult()
    data class Rejected(val reason: String) : SelectTeamResult()
}

/**
 * Attempts to select [team] for [side]. Rejects immediately (never
 * mutates state) if it would make both sides the same team -- the same
 * structural guarantee `TASK-0047`'s TypeScript version makes.
 */
fun selectTeam(state: TeamSelectionState, side: Side, team: Team): SelectTeamResult {
    val other = if (side == Side.A) state.teamB else state.teamA
    if (other != null && other.id == team.id) {
        return SelectTeamResult.Rejected("${team.name} is already selected for the other side")
    }
    val nextState = if (side == Side.A) {
        state.copy(teamA = team, squadA = emptyList())
    } else {
        state.copy(teamB = team, squadB = emptyList())
    }
    return SelectTeamResult.Selected(nextState)
}

fun swapSides(state: TeamSelectionState): TeamSelectionState =
    TeamSelectionState(teamA = state.teamB, teamB = state.teamA, squadA = state.squadB, squadB = state.squadA)

fun addPlayer(state: TeamSelectionState, side: Side, player: Player): TeamSelectionState =
    if (side == Side.A) state.copy(squadA = state.squadA + player) else state.copy(squadB = state.squadB + player)

fun removePlayer(state: TeamSelectionState, side: Side, playerId: String): TeamSelectionState =
    if (side == Side.A) {
        state.copy(squadA = state.squadA.filter { it.id != playerId })
    } else {
        state.copy(squadB = state.squadB.filter { it.id != playerId })
    }

/** UX-06's own Validation: "squad size ≥ the configured XI size before Continue." */
fun squadMeetsMinimum(squad: List<Player>, requiredXiSize: Int): Boolean = squad.size >= requiredXiSize

/** UX-06's own Validation: "Two distinct teams required... squad size ≥ the configured XI size before Continue." */
fun canContinue(state: TeamSelectionState, requiredXiSize: Int): Boolean {
    if (state.teamA == null || state.teamB == null) return false
    if (!teamsAreDistinct(state)) return false
    return squadMeetsMinimum(state.squadA, requiredXiSize) && squadMeetsMinimum(state.squadB, requiredXiSize)
}

sealed class TeamSearchState {
    object Loading : TeamSearchState()
    data class Populated(val teams: List<Team>, val isFromCache: Boolean) : TeamSearchState()
    object Empty : TeamSearchState()
    data class FetchFailedFallbackToCache(val teams: List<Team>) : TeamSearchState()
    object FetchFailedNoCache : TeamSearchState()
}

/** UX-06's own States/Error-handling/Empty-states, unified -- same shape as `TASK-0046`'s `resolveTemplateListState`. */
fun resolveTeamSearchState(
    fetchSucceeded: Boolean,
    fetchedTeams: List<Team>?,
    cachedTeams: List<Team>,
): TeamSearchState {
    if (fetchSucceeded && fetchedTeams != null) {
        return if (fetchedTeams.isEmpty()) {
            TeamSearchState.Empty
        } else {
            TeamSearchState.Populated(fetchedTeams, isFromCache = false)
        }
    }
    if (cachedTeams.isNotEmpty()) return TeamSearchState.FetchFailedFallbackToCache(cachedTeams)
    return TeamSearchState.FetchFailedNoCache
}
