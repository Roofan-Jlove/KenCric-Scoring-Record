package com.kencric.scoring.ui.screens.ux18undo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * `TASK-0072`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-18-undo/undoRedoState.test.ts` (`TASK-0071`)
 * input-for-input.
 */
class UndoRedoStateTest {

    @Test fun undo_is_unavailable_with_no_recent_action() {
        assertFalse(canUndo(deriveBaseState<String>(false)))
    }

    @Test fun undo_is_available_with_a_recent_action() {
        assertTrue(canUndo(deriveBaseState<String>(true)))
    }

    @Test fun applyGuardrailOverlay_overrides_regardless_of_underlying_state() {
        val state = applyGuardrailOverlay(deriveBaseState<String>(true), true)
        assertTrue(state is UndoRedoState.GuardrailDisabled)
        assertFalse(canUndo(state))
    }

    @Test fun applyGuardrailOverlay_passes_through_when_no_guardrail_modal_is_open() {
        val state = applyGuardrailOverlay(deriveBaseState<String>(true), false)
        assertTrue(state is UndoRedoState.Available)
    }

    @Test fun performUndo_moves_available_to_just_undone_capturing_the_undone_action() {
        val state = performUndo(deriveBaseState<String>(true), "last-one")
        assertTrue(state is UndoRedoState.JustUndone)
        assertEquals("last-one", (state as UndoRedoState.JustUndone).redoPayload)
    }

    @Test fun performUndo_is_a_no_op_when_not_available() {
        val unavailable = deriveBaseState<String>(false)
        assertEquals(unavailable, performUndo(unavailable, "x")) // both Unavailable() instances, structurally interchangeable
        assertTrue(performUndo(unavailable, "x") is UndoRedoState.Unavailable)
    }

    @Test fun canRedo_is_false_before_any_undo_has_occurred() {
        assertFalse(canRedo(deriveBaseState<String>(true)))
    }

    @Test fun canRedo_is_true_immediately_after_undo() {
        val undone = performUndo(deriveBaseState<String>(true), "last-action")
        assertTrue(canRedo(undone))
    }

    @Test fun performRedo_restores_the_undone_action_and_returns_to_available() {
        val undone = performUndo(deriveBaseState<String>(true), "last-action")
        val result = performRedo(undone)
        assertTrue(result is RedoResult.Redone)
        val redone = result as RedoResult.Redone
        assertEquals("last-action", redone.payload)
        assertTrue(redone.nextState is UndoRedoState.Available)
    }

    @Test fun performRedo_is_unavailable_outside_the_just_undone_state() {
        val result = performRedo(deriveBaseState<String>(true))
        assertTrue(result is RedoResult.Unavailable)
    }

    @Test fun onNewEntryRecorded_closes_the_redo_window() {
        val undone = performUndo(deriveBaseState<String>(true), "last-action")
        val afterNewEntry = onNewEntryRecorded<String>()
        assertTrue(afterNewEntry is UndoRedoState.Available)
        assertFalse(canRedo(afterNewEntry))
        assertTrue(canRedo(undone)) // the prior state object is untouched
    }

    @Test fun attemptUndo_reverses_cleanly_when_the_action_can_be_fully_reversed() {
        assertTrue(attemptUndo(true) is UndoOutcome.Reversed)
    }

    @Test fun attemptUndo_routes_to_score_correction_when_it_cannot() {
        val result = attemptUndo(false)
        assertTrue(result is UndoOutcome.RouteToCorrection)
        assertTrue((result as UndoOutcome.RouteToCorrection).reason.contains("Score Correction"))
    }
}
