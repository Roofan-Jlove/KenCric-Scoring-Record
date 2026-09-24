package com.kencric.scoring.ui.screens.ux06teamselection

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0048`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-06-team-selection/teamSelectionForm.test.ts`
 * (`TASK-0047`) input-for-input.
 */
class TeamSelectionFormTest {

    private val teamA = Team(id = "team-A", name = "Riverside CC", isAdHoc = false)
    private val teamB = Team(id = "team-B", name = "Harbour CC", isAdHoc = false)

    @Test fun selecting_a_first_team_succeeds() {
        val result = selectTeam(initialTeamSelectionState(), Side.A, teamA)
        assertTrue(result is SelectTeamResult.Selected)
        assertEquals(teamA, (result as SelectTeamResult.Selected).state.teamA)
    }

    @Test fun selecting_a_distinct_second_team_succeeds() {
        val afterA = selectTeam(initialTeamSelectionState(), Side.A, teamA) as SelectTeamResult.Selected
        val result = selectTeam(afterA.state, Side.B, teamB)
        assertTrue(result is SelectTeamResult.Selected)
    }

    // UX-06's own Error handling: blocked immediately, not deferred to Continue.
    @Test fun selecting_the_same_team_already_on_the_other_side_is_rejected_immediately() {
        val afterA = selectTeam(initialTeamSelectionState(), Side.A, teamA) as SelectTeamResult.Selected
        val result = selectTeam(afterA.state, Side.B, teamA)
        assertTrue(result is SelectTeamResult.Rejected)
    }

    @Test fun a_rejected_selection_never_mutates_state() {
        val afterA = selectTeam(initialTeamSelectionState(), Side.A, teamA) as SelectTeamResult.Selected
        selectTeam(afterA.state, Side.B, teamA) // rejected, result discarded
        assertNull(afterA.state.teamB)
    }

    @Test fun teamsAreDistinct_trivially_true_with_fewer_than_two_teams_selected() {
        assertTrue(teamsAreDistinct(initialTeamSelectionState()))
    }

    @Test fun swapSides_swaps_both_teams_and_their_squads_together() {
        val player = Player(id = "p1", name = "J. Smith", isAdHoc = false)
        val state = TeamSelectionState(teamA = teamA, teamB = teamB, squadA = listOf(player), squadB = emptyList())
        val swapped = swapSides(state)
        assertEquals(teamB, swapped.teamA)
        assertEquals(teamA, swapped.teamB)
        assertEquals(emptyList(), swapped.squadA)
        assertEquals(listOf(player), swapped.squadB)
    }

    @Test fun addPlayer_adds_to_the_specified_side_only() {
        val player = Player(id = "p1", name = "J. Smith", isAdHoc = true)
        val state = addPlayer(initialTeamSelectionState(), Side.A, player)
        assertEquals(listOf(player), state.squadA)
        assertEquals(emptyList(), state.squadB)
    }

    @Test fun removePlayer_removes_by_id() {
        val player = Player(id = "p1", name = "J. Smith", isAdHoc = true)
        val withPlayer = addPlayer(initialTeamSelectionState(), Side.A, player)
        val withoutPlayer = removePlayer(withPlayer, Side.A, "p1")
        assertEquals(emptyList(), withoutPlayer.squadA)
    }

    @Test fun squadMeetsMinimum_false_when_below_required_size() {
        assertFalse(squadMeetsMinimum(listOf(Player("p1", "A", false)), 11))
    }

    @Test fun canContinue_disabled_with_no_teams_selected() {
        assertFalse(canContinue(initialTeamSelectionState(), 11))
    }

    @Test fun canContinue_enabled_once_both_teams_distinct_and_squads_meet_minimum() {
        val squadA = (0 until 11).map { Player("p$it", "Player $it", false) }
        val squadB = squadA.map { it.copy(id = "b-${it.id}") }
        val state = TeamSelectionState(teamA = teamA, teamB = teamB, squadA = squadA, squadB = squadB)
        assertTrue(canContinue(state, 11))
    }

    @Test fun canContinue_disabled_if_only_one_squad_meets_the_minimum() {
        val fullSquad = (0 until 11).map { Player("p$it", "Player $it", false) }
        val state = TeamSelectionState(teamA = teamA, teamB = teamB, squadA = fullSquad, squadB = emptyList())
        assertFalse(canContinue(state, 11))
    }

    @Test fun resolveTeamSearchState_successful_fetch_with_results_is_populated_not_from_cache() {
        val teams = listOf(teamA)
        assertEquals(TeamSearchState.Populated(teams, isFromCache = false), resolveTeamSearchState(true, teams, emptyList()))
    }

    @Test fun resolveTeamSearchState_successful_fetch_with_zero_teams_is_empty() {
        assertEquals(TeamSearchState.Empty, resolveTeamSearchState(true, emptyList(), emptyList()))
    }

    @Test fun resolveTeamSearchState_failed_fetch_falls_back_to_cache() {
        val teams = listOf(teamA)
        assertEquals(TeamSearchState.FetchFailedFallbackToCache(teams), resolveTeamSearchState(false, null, teams))
    }

    @Test fun resolveTeamSearchState_failed_fetch_with_no_cache() {
        assertEquals(TeamSearchState.FetchFailedNoCache, resolveTeamSearchState(false, null, emptyList()))
    }
}
