package com.kencric.scoring.ui.screens.ux05matchsetup

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0046`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-05-match-setup/matchSetupForm.test.ts`
 * (`TASK-0045`) input-for-input.
 */
class MatchSetupFormTest {

    @Test fun oversAllotted_rejects_when_absent() {
        assertNotNull(validateOversAllotted(MatchSetupFormState()))
    }

    // B-B1: the smallest positive integer is accepted.
    @Test fun oversAllotted_accepts_1() {
        assertNull(validateOversAllotted(MatchSetupFormState(oversAllotted = 1)))
    }

    // B-B1: overs_allotted = 0 is rejected.
    @Test fun oversAllotted_rejects_0() {
        assertNotNull(validateOversAllotted(MatchSetupFormState(oversAllotted = 0)))
    }

    @Test fun matchTimezone_rejects_when_absent() {
        assertNotNull(validateMatchTimezone(MatchSetupFormState()))
    }

    @Test fun matchTimezone_accepts_a_value() {
        assertNull(validateMatchTimezone(MatchSetupFormState(matchTimezone = "Asia/Karachi")))
    }

    @Test fun powerplayOvers_no_error_when_absent() {
        assertEquals(emptyList(), validatePowerplayOvers(MatchSetupFormState(oversAllotted = 20)))
    }

    // I-B1's exact case: powerplayOvers > oversAllotted flags BOTH fields.
    @Test fun powerplayOvers_flags_both_fields_when_exceeding_oversAllotted() {
        val errors = validatePowerplayOvers(MatchSetupFormState(oversAllotted = 10, powerplayOvers = 15))
        val fields = errors.map { it.field }
        assertTrue(fields.contains("powerplayOvers"))
        assertTrue(fields.contains("oversAllotted"))
    }

    @Test fun powerplayOvers_no_error_when_within_bounds() {
        assertEquals(emptyList(), validatePowerplayOvers(MatchSetupFormState(oversAllotted = 20, powerplayOvers = 6)))
    }

    @Test fun powerplayOvers_equal_to_oversAllotted_is_not_a_violation() {
        assertEquals(emptyList(), validatePowerplayOvers(MatchSetupFormState(oversAllotted = 20, powerplayOvers = 20)))
    }

    @Test fun bowlerOverCap_flags_both_fields_when_exceeding_oversAllotted() {
        val errors = validateBowlerOverCap(MatchSetupFormState(oversAllotted = 20, bowlerOverCap = 25))
        val fields = errors.map { it.field }
        assertTrue(fields.contains("bowlerOverCap"))
        assertTrue(fields.contains("oversAllotted"))
    }

    @Test fun minOversForResult_flags_both_fields_when_exceeding_oversAllotted() {
        val errors = validateMinOversForResult(MatchSetupFormState(oversAllotted = 20, minOversForResult = 25))
        assertTrue(errors.map { it.field }.contains("minOversForResult"))
    }

    @Test fun mustHaveChecklist_both_incomplete_on_a_fresh_form() {
        val checklist = mustHaveChecklist(MatchSetupFormState())
        assertTrue(checklist.all { !it.complete })
    }

    @Test fun mustHaveChecklist_both_complete_once_valid() {
        val checklist = mustHaveChecklist(MatchSetupFormState(oversAllotted = 20, matchTimezone = "Asia/Karachi"))
        assertTrue(checklist.all { it.complete })
    }

    @Test fun canContinue_disabled_on_a_fresh_form() {
        assertFalse(canContinue(MatchSetupFormState()))
    }

    @Test fun canContinue_enabled_once_valid() {
        assertTrue(canContinue(MatchSetupFormState(oversAllotted = 20, matchTimezone = "Asia/Karachi")))
    }

    // N-B1 + I-B1 together: Must-have fields alone are not sufficient if a cross-field rule is violated.
    @Test fun canContinue_disabled_when_a_cross_field_rule_is_violated() {
        assertFalse(
            canContinue(MatchSetupFormState(oversAllotted = 10, matchTimezone = "Asia/Karachi", powerplayOvers = 15)),
        )
    }

    @Test fun validateAll_aggregates_every_rule_in_one_pass() {
        val errors = validateAll(MatchSetupFormState(oversAllotted = 10, powerplayOvers = 15, bowlerOverCap = 12))
        val fields = errors.map { it.field }
        assertTrue(fields.contains("matchTimezone"))
        assertTrue(fields.contains("powerplayOvers"))
        assertTrue(fields.contains("bowlerOverCap"))
    }
}
