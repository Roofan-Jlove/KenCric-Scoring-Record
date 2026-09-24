package com.kencric.scoring.ui.screens.ux09inningssetup

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0054`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-09-innings-setup/inningsSetupForm.test.ts`
 * (`TASK-0053`) input-for-input.
 */
class InningsSetupFormTest {

    private val battingXi = listOf(Player(id = "b1", name = "Alice"), Player(id = "b2", name = "Bea"))
    private val fieldingXi = listOf(Player(id = "f1", name = "Cara"))

    @Test fun selects_a_striker_from_the_batting_xi() {
        val result = selectStriker(initialInningsSetupState(), "b1", battingXi, "Team A")
        assertTrue(result is SelectResult.Selected)
        assertEquals("b1", (result as SelectResult.Selected).state.strikerId)
    }

    @Test fun rejects_a_striker_not_in_the_batting_xi() {
        val result = selectStriker(initialInningsSetupState(), "f1", battingXi, "Team A")
        assertTrue(result is SelectResult.Rejected)
        assertTrue((result as SelectResult.Rejected).reason.contains("Team A"))
    }

    // UX-09's own Error handling: blocked inline, not deferred to Confirm.
    @Test fun rejects_selecting_the_same_player_already_chosen_as_non_striker() {
        val withNonStriker = InningsSetupState(strikerId = null, nonStrikerId = "b2", bowlerId = null)
        val result = selectStriker(withNonStriker, "b2", battingXi, "Team A")
        assertTrue(result is SelectResult.Rejected)
    }

    @Test fun rejects_selecting_the_same_player_already_chosen_as_striker_for_non_striker() {
        val withStriker = InningsSetupState(strikerId = "b1", nonStrikerId = null, bowlerId = null)
        val result = selectNonStriker(withStriker, "b1", battingXi, "Team A")
        assertTrue(result is SelectResult.Rejected)
    }

    @Test fun a_rejected_selection_never_mutates_state() {
        val withNonStriker = InningsSetupState(strikerId = null, nonStrikerId = "b2", bowlerId = null)
        selectStriker(withNonStriker, "b2", battingXi, "Team A") // rejected, result discarded
        assertNull(withNonStriker.strikerId)
    }

    @Test fun selects_a_bowler_from_the_fielding_xi() {
        val result = selectBowler(initialInningsSetupState(), "f1", fieldingXi, "Team B")
        assertTrue(result is SelectResult.Selected)
    }

    // UX-09's own Error handling: names the correct side.
    @Test fun rejects_a_bowler_not_in_the_fielding_xi_naming_the_correct_side() {
        val result = selectBowler(initialInningsSetupState(), "b1", fieldingXi, "Team B")
        assertTrue(result is SelectResult.Rejected)
        assertTrue((result as SelectResult.Rejected).reason.contains("Team B"))
    }

    @Test fun swapEnds_swaps_striker_and_non_striker() {
        val state = InningsSetupState(strikerId = "b1", nonStrikerId = "b2", bowlerId = "f1")
        val swapped = swapEnds(state)
        assertEquals("b2", swapped.strikerId)
        assertEquals("b1", swapped.nonStrikerId)
        assertEquals("f1", swapped.bowlerId)
    }

    @Test fun confirm_is_disabled_with_no_roles_set() {
        assertFalse(canConfirm(initialInningsSetupState()))
    }

    @Test fun confirm_is_disabled_with_only_two_of_three_roles_set() {
        assertFalse(canConfirm(InningsSetupState(strikerId = "b1", nonStrikerId = "b2", bowlerId = null)))
    }

    @Test fun confirm_is_enabled_once_all_three_roles_are_set() {
        assertTrue(canConfirm(InningsSetupState(strikerId = "b1", nonStrikerId = "b2", bowlerId = "f1")))
    }

    @Test fun confirmAndStart_rejects_an_incomplete_state() {
        val result = confirmAndStart(initialInningsSetupState())
        assertTrue(result is ConfirmResult.Rejected)
    }

    @Test fun confirmAndStart_succeeds_once_complete() {
        val state = InningsSetupState(strikerId = "b1", nonStrikerId = "b2", bowlerId = "f1")
        val result = confirmAndStart(state)
        assertTrue(result is ConfirmResult.Started)
        assertEquals(state, (result as ConfirmResult.Started).state)
    }
}
