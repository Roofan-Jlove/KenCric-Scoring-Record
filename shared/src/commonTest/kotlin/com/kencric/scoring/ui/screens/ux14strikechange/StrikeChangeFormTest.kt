package com.kencric.scoring.ui.screens.ux14strikechange

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * `TASK-0064`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-14-strike-change/strikeChangeForm.test.ts`
 * (`TASK-0063`) input-for-input.
 */
class StrikeChangeFormTest {

    private val positions = StrikePositions(strikerId = "b1", nonStrikerId = "b2")

    @Test fun toggleSwap_moves_to_pending_override_without_changing_positions() {
        val state = toggleSwap(initialStrikeChangeFormState(positions))
        assertEquals(StrikeChangeState.PENDING_OVERRIDE, state.status)
        assertEquals(positions, state.positions)
    }

    @Test fun cancelSwap_returns_to_auto_and_clears_any_reason() {
        var state = toggleSwap(initialStrikeChangeFormState(positions))
        state = state.copy(reason = "typed but not confirmed")
        val cancelled = cancelSwap(state)
        assertEquals(StrikeChangeState.AUTO, cancelled.status)
        assertEquals("", cancelled.reason)
    }

    // §14.5: requires a non-empty reason.
    @Test fun confirmOverride_rejects_a_blank_reason() {
        val state = toggleSwap(initialStrikeChangeFormState(positions))
        val result = confirmOverride(state, "   ")
        assertTrue(result is ConfirmOverrideResult.Rejected)
    }

    @Test fun confirmOverride_swaps_the_current_pair_on_a_valid_reason() {
        val state = toggleSwap(initialStrikeChangeFormState(positions))
        val result = confirmOverride(state, "Running mix-up correction")
        assertTrue(result is ConfirmOverrideResult.Overridden)
        val overridden = (result as ConfirmOverrideResult.Overridden).state
        assertEquals(StrikePositions(strikerId = "b2", nonStrikerId = "b1"), overridden.positions)
        assertEquals(StrikeChangeState.OVERRIDDEN, overridden.status)
        assertEquals("Running mix-up correction", overridden.reason)
    }

    @Test fun confirmOverride_trims_the_stored_reason() {
        val state = toggleSwap(initialStrikeChangeFormState(positions))
        val result = confirmOverride(state, "  padded reason  ")
        assertTrue(result is ConfirmOverrideResult.Overridden)
        assertEquals("padded reason", (result as ConfirmOverrideResult.Overridden).state.reason)
    }

    // §14.5: "never sticky beyond the one delivery it targets."
    @Test fun resetToAutoForNextDelivery_discards_the_override() {
        val overriddenResult = confirmOverride(toggleSwap(initialStrikeChangeFormState(positions)), "reason")
        assertTrue(overriddenResult is ConfirmOverrideResult.Overridden)
        val nextAuto = StrikePositions(strikerId = "b3", nonStrikerId = "b1")
        val result = resetToAutoForNextDelivery((overriddenResult as ConfirmOverrideResult.Overridden).state, nextAuto)
        assertEquals(StrikeChangeState.AUTO, result.status)
        assertEquals(nextAuto, result.positions)
        assertEquals("", result.reason)
    }
}
