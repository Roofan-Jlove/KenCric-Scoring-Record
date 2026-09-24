package com.kencric.scoring.ui.screens.ux17scorecorrection

import com.kencric.scoring.core.pipeline.CascadeSummary
import com.kencric.scoring.core.pipeline.InningsEndTimingChange
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * `TASK-0070`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-17-score-correction/
 * scoreCorrectionForm.test.ts` (`TASK-0069`) input-for-input, using the
 * real `core.pipeline.CascadeSummary`/`InningsEndTimingChange` types.
 */
class ScoreCorrectionFormTest {

    private val noCascade = CascadeSummary(
        endTimingChange = InningsEndTimingChange(),
        firstStrikeContinuityBreakIndex = null,
    )

    // AUD-005
    @Test fun blocks_a_blank_reason_on_a_non_final_match() {
        val state = CorrectionFormState(reason = "   ", isFinal = false, hasElevatedRole = false)
        val result = canConfirmCorrection(state)
        assertTrue(result is ConfirmResult.Blocked)
        assertEquals("A reason is required for every correction", (result as ConfirmResult.Blocked).reason)
    }

    @Test fun allows_a_non_blank_reason_on_a_non_final_match_with_no_elevated_role_needed() {
        val state = CorrectionFormState(reason = "Fixed a mis-scored boundary", isFinal = false, hasElevatedRole = false)
        assertEquals(ConfirmResult.Allowed, canConfirmCorrection(state))
    }

    // BR-006 / §19.3
    @Test fun blocks_a_final_match_correction_without_an_elevated_role_even_with_a_valid_reason() {
        val state = CorrectionFormState(reason = "Fixed a mis-scored boundary", isFinal = true, hasElevatedRole = false)
        val result = canConfirmCorrection(state)
        assertTrue(result is ConfirmResult.Blocked)
        assertTrue((result as ConfirmResult.Blocked).reason.contains("elevated role"))
    }

    @Test fun the_reason_blank_failure_takes_priority_over_the_elevated_role_failure() {
        val state = CorrectionFormState(reason = "", isFinal = true, hasElevatedRole = false)
        val result = canConfirmCorrection(state)
        assertTrue(result is ConfirmResult.Blocked)
        assertEquals("A reason is required for every correction", (result as ConfirmResult.Blocked).reason)
    }

    @Test fun allows_a_final_match_correction_with_both_a_reason_and_an_elevated_role() {
        val state = CorrectionFormState(reason = "Fixed a mis-scored boundary", isFinal = true, hasElevatedRole = true)
        assertEquals(ConfirmResult.Allowed, canConfirmCorrection(state))
    }

    @Test fun reports_no_downstream_changes_when_the_cascade_is_empty() {
        assertEquals(listOf("No downstream changes detected"), describeCascade(noCascade))
    }

    @Test fun reports_a_strike_continuity_break_at_a_1_based_delivery_number() {
        val summary = noCascade.copy(firstStrikeContinuityBreakIndex = 4)
        assertTrue(describeCascade(summary).contains("Strike continuity breaks at delivery 5"))
    }

    @Test fun reports_an_orphaned_delivery_count() {
        val summary = noCascade.copy(endTimingChange = InningsEndTimingChange(orphanedDeliveryCount = 3))
        assertTrue(describeCascade(summary).contains("3 later deliveries are now outside the innings"))
    }

    @Test fun reports_a_requires_continuation_case() {
        val summary = noCascade.copy(endTimingChange = InningsEndTimingChange(requiresContinuation = true))
        assertTrue(describeCascade(summary).contains("The innings no longer ends here -- further deliveries are required"))
    }

    @Test fun reports_all_applicable_lines_together_not_just_the_first() {
        val summary = CascadeSummary(
            endTimingChange = InningsEndTimingChange(orphanedDeliveryCount = 2, requiresContinuation = false),
            firstStrikeContinuityBreakIndex = 0,
        )
        assertEquals(2, describeCascade(summary).size)
    }
}
