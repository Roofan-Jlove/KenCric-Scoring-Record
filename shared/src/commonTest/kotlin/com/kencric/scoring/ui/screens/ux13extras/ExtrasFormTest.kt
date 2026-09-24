package com.kencric.scoring.ui.screens.ux13extras

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * `TASK-0062`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-13-extras/extrasForm.test.ts` (`TASK-0061`)
 * input-for-input. The TypeScript version's non-integer `additionalRuns`
 * rejection test has no Kotlin equivalent -- `Int` is already integer-
 * only in Kotlin's type system, so that check is structurally
 * unnecessary here, not a parity gap (same adaptation `TASK-0058` made).
 */
class ExtrasFormTest {

    // BR-034/BR-035
    @Test fun byes_and_leg_byes_count_as_legal_balls() {
        assertTrue(consumesLegalBall(ExtraType.BYE))
        assertTrue(consumesLegalBall(ExtraType.LEG_BYE))
    }

    @Test fun wides_and_no_balls_do_not_count_as_legal_balls() {
        assertFalse(consumesLegalBall(ExtraType.WIDE))
        assertFalse(consumesLegalBall(ExtraType.NO_BALL))
    }

    @Test fun penalty_does_not_consume_a_legal_ball_by_default() {
        assertFalse(consumesLegalBall(ExtraType.PENALTY))
    }

    @Test fun a_type_in_the_enabled_set_is_enabled() {
        assertTrue(isTypeEnabled(ExtraType.WIDE, setOf(ExtraType.WIDE, ExtraType.BYE)))
    }

    @Test fun a_type_not_in_the_enabled_set_is_disabled() {
        assertFalse(isTypeEnabled(ExtraType.PENALTY, setOf(ExtraType.WIDE, ExtraType.BYE)))
    }

    @Test fun rejects_an_unselected_type() {
        assertTrue(validateSubmission(initialExtrasFormState()) is SubmitResult.Invalid)
    }

    @Test fun accepts_a_valid_non_penalty_extra() {
        val state = ExtrasFormState(type = ExtraType.BYE, additionalRuns = 2)
        assertEquals(SubmitResult.Valid(state), validateSubmission(state))
    }

    @Test fun rejects_a_negative_additional_runs_value() {
        val state = ExtrasFormState(type = ExtraType.WIDE, additionalRuns = -1)
        assertTrue(validateSubmission(state) is SubmitResult.Invalid)
    }

    // BR-036
    @Test fun rejects_a_penalty_with_a_blank_reason() {
        val state = ExtrasFormState(type = ExtraType.PENALTY, penaltyReason = "   ", penaltyRecipientSide = PenaltyRecipientSide.BATTING)
        val result = validateSubmission(state)
        assertTrue(result is SubmitResult.Invalid)
        assertTrue((result as SubmitResult.Invalid).reason.contains("reason"))
    }

    @Test fun rejects_a_penalty_with_no_recipient_side() {
        val state = ExtrasFormState(type = ExtraType.PENALTY, penaltyReason = "Deliberate obstruction", penaltyRecipientSide = null)
        assertTrue(validateSubmission(state) is SubmitResult.Invalid)
    }

    @Test fun accepts_a_fully_completed_penalty() {
        val state = ExtrasFormState(
            type = ExtraType.PENALTY,
            penaltyReason = "Deliberate obstruction",
            penaltyRecipientSide = PenaltyRecipientSide.BATTING,
        )
        assertEquals(SubmitResult.Valid(state), validateSubmission(state))
    }
}
