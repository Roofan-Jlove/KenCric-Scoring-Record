package com.kencric.scoring.ui.screens.ux08toss

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * `TASK-0052`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-08-toss/tossForm.test.ts` (`TASK-0051`)
 * input-for-input.
 */
class TossFormTest {

    @Test fun confirm_is_disabled_with_neither_field_set() {
        assertFalse(canConfirm(initialTossState()))
    }

    @Test fun confirm_is_disabled_with_only_the_winner_set() {
        assertFalse(canConfirm(TossState(winner = TossWinner.A, decision = null, confirmed = false)))
    }

    @Test fun confirm_is_enabled_once_both_fields_are_set() {
        assertTrue(canConfirm(TossState(winner = TossWinner.A, decision = TossDecision.BAT, confirmed = false)))
    }

    @Test fun confirmToss_rejects_when_a_field_is_missing() {
        val result = confirmToss(TossState(winner = TossWinner.A, decision = null, confirmed = false))
        assertTrue(result is ConfirmResult.Rejected)
    }

    @Test fun confirmToss_succeeds_and_locks_the_state_once_both_fields_are_set() {
        val result = confirmToss(TossState(winner = TossWinner.A, decision = TossDecision.BAT, confirmed = false))
        assertTrue(result is ConfirmResult.Confirmed)
        assertTrue((result as ConfirmResult.Confirmed).state.confirmed)
    }

    @Test fun confirmToss_rejects_a_second_confirm_attempt() {
        val result = confirmToss(TossState(winner = TossWinner.A, decision = TossDecision.BAT, confirmed = true))
        assertTrue(result is ConfirmResult.Rejected)
    }

    // N-B2
    @Test fun n_b2_team_a_elects_to_bat_means_a_bats_first_b_is_chasing() {
        assertEquals(InningsOrder(TossWinner.A, TossWinner.B), deriveInningsOrder(TossWinner.A, TossDecision.BAT))
    }

    @Test fun team_a_elects_to_bowl_means_b_bats_first_a_is_chasing() {
        assertEquals(InningsOrder(TossWinner.B, TossWinner.A), deriveInningsOrder(TossWinner.A, TossDecision.BOWL))
    }

    @Test fun team_b_elects_to_bat_means_b_bats_first_a_is_chasing() {
        assertEquals(InningsOrder(TossWinner.B, TossWinner.A), deriveInningsOrder(TossWinner.B, TossDecision.BAT))
    }

    @Test fun team_b_elects_to_bowl_means_a_bats_first_b_is_chasing() {
        assertEquals(InningsOrder(TossWinner.A, TossWinner.B), deriveInningsOrder(TossWinner.B, TossDecision.BOWL))
    }

    @Test fun an_edit_attempt_is_allowed_when_the_toss_isnt_locked() {
        assertEquals(EditAttemptResult.ALLOWED, attemptEdit(false))
    }

    @Test fun an_edit_attempt_requires_amendment_once_locked() {
        assertEquals(EditAttemptResult.REQUIRES_AMENDMENT, attemptEdit(true))
    }

    @Test fun amendToss_rejects_a_blank_reason() {
        val result = amendToss(TossWinner.B, TossDecision.BOWL, "   ")
        assertTrue(result is AmendResult.Rejected)
    }

    @Test fun amendToss_succeeds_with_a_non_blank_reason_and_applies_the_new_winner_decision() {
        val result = amendToss(TossWinner.B, TossDecision.BOWL, "Original toss winner recorded incorrectly")
        assertTrue(result is AmendResult.Amended)
        val amendedState = (result as AmendResult.Amended).state
        assertEquals(TossState(winner = TossWinner.B, decision = TossDecision.BOWL, confirmed = true), amendedState)
    }
}
