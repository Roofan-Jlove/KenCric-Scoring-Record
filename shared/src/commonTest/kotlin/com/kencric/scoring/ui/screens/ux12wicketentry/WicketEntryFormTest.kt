package com.kencric.scoring.ui.screens.ux12wicketentry

import com.kencric.scoring.core.model.CreaseEnd
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.validDismissalModesFor
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0060`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-12-wicket-entry/wicketEntryForm.test.ts`
 * (`TASK-0059`) input-for-input, for the screen-specific logic this
 * file adds on top of the already-shared `core.model` types.
 */
class WicketEntryFormTest {

    @Test fun a_normal_legal_delivery_offers_the_full_8_mode_set() {
        val modes = validDismissalModesFor(Legality.LEGAL, false)
        assertEquals(8, modes.size)
        assertTrue(DismissalMode.BOWLED in modes)
        assertTrue(DismissalMode.CAUGHT in modes)
    }

    // BR-033
    @Test fun a_free_hit_restricts_to_run_out_obstructing_hit_ball_twice() {
        val modes = validDismissalModesFor(Legality.LEGAL, true)
        assertEquals(setOf(DismissalMode.RUN_OUT, DismissalMode.OBSTRUCTING_THE_FIELD, DismissalMode.HIT_BALL_TWICE), modes)
    }

    // BR-032
    @Test fun a_no_ball_does_not_offer_stumped() {
        val modes = validDismissalModesFor(Legality.NO_BALL, false)
        assertFalse(DismissalMode.STUMPED in modes)
        assertTrue(DismissalMode.RUN_OUT in modes)
    }

    @Test fun timed_out_and_retired_out_are_always_offered_regardless_of_legality_free_hit() {
        assertTrue(modeIsOffered(DismissalMode.TIMED_OUT, Legality.DEAD_BALL, false))
        assertTrue(modeIsOffered(DismissalMode.RETIRED_OUT, Legality.LEGAL, true))
    }

    @Test fun other_modes_follow_validDismissalModesFor_exactly() {
        assertFalse(modeIsOffered(DismissalMode.STUMPED, Legality.NO_BALL, false))
        assertTrue(modeIsOffered(DismissalMode.RUN_OUT, Legality.NO_BALL, false))
    }

    @Test fun reasonModeNotOffered_is_null_when_the_mode_is_offered() {
        assertNull(reasonModeNotOffered(DismissalMode.RUN_OUT, Legality.LEGAL, false))
    }

    @Test fun reasonModeNotOffered_gives_a_one_line_reason_when_not_offered() {
        assertTrue(reasonModeNotOffered(DismissalMode.STUMPED, Legality.NO_BALL, false)!!.contains("no-ball"))
        assertTrue(reasonModeNotOffered(DismissalMode.BOWLED, Legality.LEGAL, true)!!.contains("free hit"))
    }

    @Test fun requiredFieldsForMode_caught_requires_a_fielder() {
        assertEquals(listOf(RequiredField.FIELDER_IDS), requiredFieldsForMode(DismissalMode.CAUGHT))
    }

    @Test fun requiredFieldsForMode_run_out_requires_crossedBeforeDismissal() {
        assertEquals(listOf(RequiredField.CROSSED_BEFORE_DISMISSAL), requiredFieldsForMode(DismissalMode.RUN_OUT))
    }

    @Test fun requiredFieldsForMode_bowled_requires_neither() {
        assertEquals(emptyList(), requiredFieldsForMode(DismissalMode.BOWLED))
    }

    private val validBowled = WicketFormState(
        mode = DismissalMode.BOWLED,
        outBatterId = "b1",
        endVacated = CreaseEnd.STRIKER,
        fielderIds = emptyList(),
        crossedBeforeDismissal = null,
        incomingBatterId = "b3",
    )

    @Test fun an_empty_state_is_missing_at_minimum_the_mode() {
        assertEquals(listOf(MissingField(MissingFieldKind.MODE, "Select a dismissal mode")), missingFields(WicketFormState(), false))
    }

    @Test fun a_fully_complete_bowled_dismissal_has_no_missing_fields() {
        assertEquals(emptyList(), missingFields(validBowled, false))
        assertTrue(canConfirm(validBowled, false))
    }

    @Test fun caught_without_a_fielder_is_blocked_naming_that_field() {
        val state = validBowled.copy(mode = DismissalMode.CAUGHT, fielderIds = emptyList())
        val missing = missingFields(state, false)
        assertTrue(missing.contains(MissingField(MissingFieldKind.FIELDER_IDS, "Select the fielder")))
    }

    @Test fun run_out_without_crossedBeforeDismissal_is_blocked_naming_that_field() {
        val state = validBowled.copy(mode = DismissalMode.RUN_OUT)
        val missing = missingFields(state, false)
        assertTrue(missing.contains(MissingField(MissingFieldKind.CROSSED_BEFORE_DISMISSAL, "Select whether the batters crossed")))
    }

    @Test fun incoming_batter_is_required_unless_the_dismissal_ends_the_innings() {
        val state = validBowled.copy(incomingBatterId = null)
        assertFalse(canConfirm(state, false))
        assertTrue(canConfirm(state, true))
    }
}
