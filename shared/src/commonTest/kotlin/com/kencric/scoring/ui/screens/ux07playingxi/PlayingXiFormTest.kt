package com.kencric.scoring.ui.screens.ux07playingxi

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0050`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-07-playing-xi/playingXiForm.test.ts`
 * (`TASK-0049`) input-for-input.
 */
class PlayingXiFormTest {

    private fun squadOf(count: Int): List<Player> =
        (0 until count).map { Player(id = "p$it", name = "Player $it", isAdHoc = false) }

    @Test fun toggling_a_player_on_adds_them_to_selectedIds() {
        val state = initialSideXiState(squadOf(11))
        val result = togglePlayer(state, "p0", 11)
        assertTrue(result is ToggleResult.Toggled)
        assertEquals(listOf("p0"), (result as ToggleResult.Toggled).state.selectedIds)
    }

    // UX-07's own Error handling: blocked at the moment of the extra tap, not deferred to Continue.
    @Test fun toggling_on_past_the_required_xi_size_is_blocked_immediately() {
        val squad = squadOf(2)
        var state = initialSideXiState(squad)
        val first = togglePlayer(state, "p0", 1) as ToggleResult.Toggled
        state = first.state
        val second = togglePlayer(state, "p1", 1)
        assertTrue(second is ToggleResult.Blocked)
        assertEquals("XI is full — remove someone first", (second as ToggleResult.Blocked).reason)
    }

    @Test fun blocking_never_mutates_state() {
        val squad = squadOf(2)
        val first = togglePlayer(initialSideXiState(squad), "p0", 1) as ToggleResult.Toggled
        togglePlayer(first.state, "p1", 1) // blocked, result discarded
        assertEquals(listOf("p0"), first.state.selectedIds)
    }

    @Test fun toggling_off_removes_the_player_and_clears_captain_and_keeper_if_they_held_either_role() {
        var state = initialSideXiState(squadOf(2))
        state = (togglePlayer(state, "p0", 2) as ToggleResult.Toggled).state
        state = (setCaptain(state, "p0") as SetRoleResult.Set).state
        state = (setKeeper(state, "p0") as SetRoleResult.Set).state
        val removed = togglePlayer(state, "p0", 2)
        assertTrue(removed is ToggleResult.Toggled)
        val removedState = (removed as ToggleResult.Toggled).state
        assertEquals(emptyList(), removedState.selectedIds)
        assertNull(removedState.captainId)
        assertNull(removedState.keeperId)
    }

    @Test fun setCaptain_rejects_marking_a_captain_who_isnt_selected_in_the_xi() {
        val state = initialSideXiState(squadOf(2))
        val result = setCaptain(state, "p0")
        assertTrue(result is SetRoleResult.Rejected)
    }

    @Test fun marking_a_second_captain_replaces_the_first() {
        var state = initialSideXiState(squadOf(2))
        state = (togglePlayer(state, "p0", 2) as ToggleResult.Toggled).state
        state = (togglePlayer(state, "p1", 2) as ToggleResult.Toggled).state
        state = (setCaptain(state, "p0") as SetRoleResult.Set).state
        state = (setCaptain(state, "p1") as SetRoleResult.Set).state
        assertEquals("p1", state.captainId)
    }

    @Test fun addAdHocPlayer_adds_to_the_squad_and_immediately_into_the_xi() {
        val state = initialSideXiState(squadOf(1))
        val result = addAdHocPlayer(state, "J. Smith", 11, "adhoc-1")
        assertTrue(result is AddAdHocResult.Added)
        val addedState = (result as AddAdHocResult.Added).state
        assertEquals(2, addedState.squad.size)
        assertTrue(addedState.selectedIds.contains("adhoc-1"))
    }

    @Test fun addAdHocPlayer_is_blocked_immediately_if_the_xi_is_already_full() {
        var state = initialSideXiState(squadOf(1))
        state = (togglePlayer(state, "p0", 1) as ToggleResult.Toggled).state
        val result = addAdHocPlayer(state, "J. Smith", 1, "adhoc-1")
        assertTrue(result is AddAdHocResult.Blocked)
    }

    @Test fun n_c1_exactly_11_selected_plus_1_captain_plus_1_keeper_is_valid() {
        var state = initialSideXiState(squadOf(11))
        for (p in state.squad) {
            state = (togglePlayer(state, p.id, 11) as ToggleResult.Toggled).state
        }
        state = (setCaptain(state, "p0") as SetRoleResult.Set).state
        state = (setKeeper(state, "p1") as SetRoleResult.Set).state
        assertTrue(sideIsValid(state, 11))
        assertEquals(emptyList(), sideValidationIssues(state, Side.A, 11))
    }

    @Test fun b_c1_exactly_11_selected_plus_0_keepers_is_blocked_identifying_wicket_keeper_required() {
        var state = initialSideXiState(squadOf(11))
        for (p in state.squad) {
            state = (togglePlayer(state, p.id, 11) as ToggleResult.Toggled).state
        }
        state = (setCaptain(state, "p0") as SetRoleResult.Set).state
        assertFalse(sideIsValid(state, 11))
        val issues = sideValidationIssues(state, Side.A, 11)
        assertTrue(issues.contains(SideValidationIssue(Side.A, SideValidationIssueKind.KEEPER, "Team A: wicket-keeper required")))
    }

    @Test fun b_c1_exactly_11_selected_plus_1_keeper_marked_passes_the_keeper_check() {
        var state = initialSideXiState(squadOf(11))
        for (p in state.squad) {
            state = (togglePlayer(state, p.id, 11) as ToggleResult.Toggled).state
        }
        state = (setKeeper(state, "p0") as SetRoleResult.Set).state
        val issues = sideValidationIssues(state, Side.A, 11)
        assertFalse(issues.any { it.issue == SideValidationIssueKind.KEEPER })
    }

    @Test fun i_c1_the_same_player_id_selected_in_both_sides_xis_is_identified_specifically() {
        var sideA = initialSideXiState(squadOf(1))
        sideA = (togglePlayer(sideA, "p0", 1) as ToggleResult.Toggled).state
        var sideB = initialSideXiState(squadOf(1))
        sideB = (togglePlayer(sideB, "p0", 1) as ToggleResult.Toggled).state
        assertEquals("p0", findDuplicatePlayerId(PlayingXiState(sideA, sideB)))
    }

    @Test fun canContinue_is_false_while_a_duplicate_player_id_exists_even_if_both_sides_are_otherwise_valid() {
        var sideA = initialSideXiState(squadOf(1))
        sideA = (togglePlayer(sideA, "p0", 1) as ToggleResult.Toggled).state
        sideA = (setCaptain(sideA, "p0") as SetRoleResult.Set).state
        sideA = (setKeeper(sideA, "p0") as SetRoleResult.Set).state
        var sideB = initialSideXiState(squadOf(1))
        sideB = (togglePlayer(sideB, "p0", 1) as ToggleResult.Toggled).state
        sideB = (setCaptain(sideB, "p0") as SetRoleResult.Set).state
        sideB = (setKeeper(sideB, "p0") as SetRoleResult.Set).state
        assertFalse(canContinue(PlayingXiState(sideA, sideB), 1))
    }

    @Test fun canContinue_is_true_once_both_sides_are_valid_and_no_duplicate_exists() {
        var sideA = initialSideXiState(squadOf(1))
        sideA = (togglePlayer(sideA, "p0", 1) as ToggleResult.Toggled).state
        sideA = (setCaptain(sideA, "p0") as SetRoleResult.Set).state
        sideA = (setKeeper(sideA, "p0") as SetRoleResult.Set).state
        var sideB = initialSideXiState(listOf(Player(id = "q0", name = "Q0", isAdHoc = false)))
        sideB = (togglePlayer(sideB, "q0", 1) as ToggleResult.Toggled).state
        sideB = (setCaptain(sideB, "q0") as SetRoleResult.Set).state
        sideB = (setKeeper(sideB, "q0") as SetRoleResult.Set).state
        assertTrue(canContinue(PlayingXiState(sideA, sideB), 1))
    }
}
