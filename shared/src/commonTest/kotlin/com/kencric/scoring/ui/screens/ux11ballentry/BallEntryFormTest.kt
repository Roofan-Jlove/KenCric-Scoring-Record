package com.kencric.scoring.ui.screens.ux11ballentry

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * `TASK-0058`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-11-ball-entry/ballEntryForm.test.ts`
 * (`TASK-0057`) input-for-input. The TypeScript version's non-integer-
 * input rejection tests have no Kotlin equivalent -- `Int` is already
 * integer-only in Kotlin's type system, so that check is structurally
 * unnecessary here, not a parity gap.
 */
class BallEntryFormTest {

    @Test fun accepts_a_valid_primary_tap_with_no_overthrow() {
        val result = composeRunValue(4, 0)
        assertEquals(RunValueResult.Valid(4), result)
    }

    @Test fun composes_a_primary_tap_plus_an_overthrow_add_on() {
        val result = composeRunValue(1, 4)
        assertEquals(RunValueResult.Valid(5), result)
    }

    @Test fun accepts_the_boundary_values_0_and_6() {
        assertEquals(RunValueResult.Valid(0), composeRunValue(0, 0))
        assertEquals(RunValueResult.Valid(6), composeRunValue(6, 0))
    }

    @Test fun rejects_a_primary_tap_above_6() {
        assertTrue(composeRunValue(7, 0) is RunValueResult.Invalid)
    }

    @Test fun rejects_a_negative_primary_tap() {
        assertTrue(composeRunValue(-1, 0) is RunValueResult.Invalid)
    }

    @Test fun rejects_a_negative_overthrow_add_on() {
        assertTrue(composeRunValue(1, -1) is RunValueResult.Invalid)
    }

    @Test fun requiresLightweightConfirm_does_not_require_confirmation_at_or_below_the_threshold() {
        assertFalse(requiresLightweightConfirm(4, 4))
        assertFalse(requiresLightweightConfirm(2, 4))
    }

    @Test fun requiresLightweightConfirm_requires_confirmation_above_the_threshold() {
        assertTrue(requiresLightweightConfirm(5, 4))
    }

    private val base = BallEntryStateInputs(isGuardrailModalOpen = false, justRecorded = false, undoAvailable = false)

    @Test fun ready_when_nothing_else_applies() {
        assertEquals(BallEntryState.READY, deriveBallEntryState(base))
    }

    @Test fun undo_available_when_undo_is_available_and_nothing_higher_priority_applies() {
        assertEquals(BallEntryState.UNDO_AVAILABLE, deriveBallEntryState(base.copy(undoAvailable = true)))
    }

    @Test fun just_recorded_takes_priority_over_undo_available() {
        assertEquals(
            BallEntryState.JUST_RECORDED,
            deriveBallEntryState(base.copy(undoAvailable = true, justRecorded = true)),
        )
    }

    @Test fun guardrail_blocked_takes_priority_over_everything_else() {
        assertEquals(
            BallEntryState.GUARDRAIL_BLOCKED,
            deriveBallEntryState(base.copy(justRecorded = true, isGuardrailModalOpen = true)),
        )
    }

    // UX-11's own Validation: submission blocked only while a guardrail modal is open.
    @Test fun canSubmit_is_false_only_when_guardrail_blocked() {
        assertTrue(canSubmit(BallEntryState.READY))
        assertTrue(canSubmit(BallEntryState.JUST_RECORDED))
        assertTrue(canSubmit(BallEntryState.UNDO_AVAILABLE))
        assertFalse(canSubmit(BallEntryState.GUARDRAIL_BLOCKED))
    }
}
