package com.kencric.scoring.ui.screens.ux15bowlerchange

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * `TASK-0066`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-15-bowler-change/bowlerChangeForm.test.ts`
 * (`TASK-0065`) input-for-input.
 */
class BowlerChangeFormTest {

    private fun candidate(
        id: String = "bowler-1",
        legalBallsBowled: Int = 0,
    ): BowlerCandidate = BowlerCandidate(id = id, name = "J. Smith", legalBallsBowled = legalBallsBowled, runsCharged = 0, wickets = 0, maidens = 0)

    // BR-027
    @Test fun blocks_the_immediately_preceding_over_bowler() {
        val blocks = guardrailBlocksFor(candidate(id = "bowler-1"), "bowler-1", null, 6)
        assertTrue(GuardrailRule.CONSECUTIVE_OVER in blocks)
    }

    @Test fun does_not_block_a_candidate_who_did_not_bowl_the_previous_over() {
        val blocks = guardrailBlocksFor(candidate(id = "bowler-2"), "bowler-1", null, 6)
        assertFalse(GuardrailRule.CONSECUTIVE_OVER in blocks)
    }

    @Test fun does_not_block_anyone_when_there_was_no_previous_over() {
        val blocks = guardrailBlocksFor(candidate(id = "bowler-1"), null, null, 6)
        assertFalse(GuardrailRule.CONSECUTIVE_OVER in blocks)
    }

    // BR-028 / B-D3
    @Test fun b_d3_a_bowler_at_exactly_bowlerOverCap_minus_1_overs_bowled_is_accepted() {
        val blocks = guardrailBlocksFor(candidate(legalBallsBowled = 18), null, 4, 6)
        assertFalse(GuardrailRule.OVER_LIMIT in blocks)
    }

    @Test fun b_d3_a_bowler_at_exactly_bowlerOverCap_overs_bowled_is_blocked() {
        val blocks = guardrailBlocksFor(candidate(legalBallsBowled = 24), null, 4, 6)
        assertTrue(GuardrailRule.OVER_LIMIT in blocks)
    }

    @Test fun no_cap_configured_never_blocks_on_over_limit() {
        val blocks = guardrailBlocksFor(candidate(legalBallsBowled = 1000), null, null, 6)
        assertFalse(GuardrailRule.OVER_LIMIT in blocks)
    }

    @Test fun a_bowler_can_be_blocked_by_both_guardrails_simultaneously() {
        val blocks = guardrailBlocksFor(candidate(id = "bowler-1", legalBallsBowled = 24), "bowler-1", 4, 6)
        assertEquals(listOf(GuardrailRule.CONSECUTIVE_OVER, GuardrailRule.OVER_LIMIT), blocks)
    }

    @Test fun isGuardrailBlocked_mirrors_guardrailBlocksFor_own_emptiness() {
        assertFalse(isGuardrailBlocked(candidate(id = "bowler-2"), "bowler-1", null, 6))
        assertTrue(isGuardrailBlocked(candidate(id = "bowler-1"), "bowler-1", null, 6))
    }

    @Test fun guardrailMessage_states_the_specific_rule_plainly() {
        assertTrue(guardrailMessage(GuardrailRule.CONSECUTIVE_OVER).contains("consecutive"))
        assertTrue(guardrailMessage(GuardrailRule.OVER_LIMIT).contains("maximum overs"))
    }

    // V10
    @Test fun confirmSelection_an_unblocked_candidate_confirms_with_no_reason_required() {
        val result = confirmSelection(candidate(), emptyList(), "")
        assertEquals(ConfirmResult.Confirmed("bowler-1"), result)
    }

    @Test fun confirmSelection_a_blocked_candidate_is_rejected_with_a_blank_override_reason() {
        val result = confirmSelection(candidate(), listOf(GuardrailRule.CONSECUTIVE_OVER), "   ")
        assertTrue(result is ConfirmResult.Rejected)
    }

    @Test fun confirmSelection_a_blocked_candidate_confirms_with_a_non_blank_override_reason() {
        val result = confirmSelection(candidate(), listOf(GuardrailRule.OVER_LIMIT), "No other bowlers fit for purpose")
        assertEquals(ConfirmResult.Confirmed("bowler-1"), result)
    }
}
