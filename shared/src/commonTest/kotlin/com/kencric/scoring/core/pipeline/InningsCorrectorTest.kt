package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.config.PlayingConditionsProfile
import com.kencric.scoring.core.model.BattingContext
import com.kencric.scoring.core.model.CreaseEnd
import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.FoldConfig
import com.kencric.scoring.core.model.InningsFoldState
import com.kencric.scoring.core.model.InningsScoreState
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.OverState
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.RUN
import com.kencric.scoring.core.model.RunEventOrigin.OFF_BAT
import com.kencric.scoring.core.model.WicketDetail
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * live-scoring.md §19. §19.2's two sub-cases are tested with small,
 * purpose-built scenarios exercising the exact structural property
 * §22.12's EX-13 describes (a correction shifting whether/when the
 * innings ends), rather than transcribing EX-13's own multi-over,
 * dozens-of-deliveries narrative verbatim -- that scale isn't reviewable
 * as a unit test; the underlying mechanism is the same either way.
 */
class InningsCorrectorTest {

    private val profile = PlayingConditionsProfile(ballsPerOver = 6)
    private val config = FoldConfig(profile = profile, bowlingTeamId = "fielding", maxWicketsPerInnings = 10, oversAllotted = 20, target = null)

    private val genesis = InningsFoldState(
        batterCardLines = emptyMap(), bowlerCardLines = emptyMap(),
        score = InningsScoreState(), over = OverState(overNumber = 1, bowlerId = "X"),
        strikerBatterId = "A", nonStrikerBatterId = "B", freeHitPending = false, inningsEndReason = null,
    )

    private val battingContext = BattingContext(
        battingXiPlayerIds = setOf("A", "B", "C"),
        alreadyBattedPlayerIds = setOf("A", "B"),
        notOutPlayerIds = setOf("A", "B"),
    )

    private fun dot() = DeliveryInput(Legality.LEGAL, "A", "B", "X", isFreeHit = false)
    private fun single() = DeliveryInput(Legality.LEGAL, "A", "B", "X", isFreeHit = false, runEvents = listOf(RunEvent(OFF_BAT, 1, RUN)))

    // §19.1 step 2: a correction cannot introduce a state fresh entry
    // would have rejected -- CAUGHT (an always-zero-runs mode, §9.3/V6)
    // with non-empty runEvents must be rejected, not silently applied.
    @Test fun invalid_correction_is_rejected_not_applied() {
        val invalidCorrection = dot().copy(
            runEvents = listOf(RunEvent(OFF_BAT, 4, RUN)),
            wicket = WicketDetail(mode = DismissalMode.CAUGHT, outBatterId = "A", endVacated = CreaseEnd.STRIKER, fielderIds = listOf("f1"), incomingBatterId = "C"),
        )
        val outcome = correctDelivery(genesis, listOf(dot()), 0, invalidCorrection, battingContext, config)
        assertTrue(outcome is CorrectionOutcome.Rejected)
    }

    // §19.1 step 4's central claim: a correction to an early delivery's
    // run value can flip who was on strike for every following ball,
    // even one that was itself never edited.
    @Test fun correction_cascades_strike_to_a_later_untouched_delivery() {
        val original = listOf(single(), single())
        val correctedTo2Runs = single().copy(runEvents = listOf(RunEvent(OFF_BAT, 2, RUN)))

        val outcome = correctDelivery(genesis, original, 0, correctedTo2Runs, battingContext, config)
        check(outcome is CorrectionOutcome.Applied)

        val originalTrace = foldTrace(genesis, original, config)
        val correctedTrace = foldTrace(genesis, outcome.correctedDeliveries, config)

        // delivery[1] (the single) was never itself corrected, but its
        // re-derived strike position still differs, because delivery[0]'s
        // run-parity changed from odd (rotates) to even (doesn't).
        assertNotEquals(originalTrace[1].strikerBatterId, correctedTrace[1].strikerBatterId)
        assertEquals(0, outcome.cascadeSummary.firstStrikeContinuityBreakIndex)
    }

    // A correction with no downstream effect at all reports no break.
    @Test fun a_correction_with_no_behavioral_difference_reports_no_strike_break() {
        val original = listOf(dot())
        // Same legal, zero-run outcome, different commentary only.
        val corrected = dot().copy(commentary = "clarified after review")
        val outcome = correctDelivery(genesis, original, 0, corrected, battingContext, config)
        check(outcome is CorrectionOutcome.Applied)
        assertNull(outcome.cascadeSummary.firstStrikeContinuityBreakIndex)
    }

    // §19.2 sub-case 1: "the innings now appears to have ended earlier
    // than it originally did" -- later active deliveries become orphaned,
    // flagged, never silently discarded.
    @Test fun ends_earlier_flags_orphaned_trailing_deliveries() {
        val nearAllOut = genesis.copy(score = genesis.score.copy(wicketsLost = 9))
        val original = listOf(dot(), dot(), dot())
        val tenthWicket = dot().copy(
            wicket = WicketDetail(mode = DismissalMode.BOWLED, outBatterId = "A", endVacated = CreaseEnd.STRIKER, incomingBatterId = null),
        )

        val outcome = correctDelivery(nearAllOut, original, 0, tenthWicket, battingContext, config)
        check(outcome is CorrectionOutcome.Applied)
        assertEquals(2, outcome.cascadeSummary.endTimingChange.orphanedDeliveryCount, "deliveries[1] and [2] are now beyond the corrected all-out point")
        assertTrue(!outcome.cascadeSummary.endTimingChange.requiresContinuation)
    }

    // §19.2 sub-case 2: "the innings now appears not to have ended when
    // it originally did" -- "correction requires continuation," the
    // engine never invents the deliveries that would have followed.
    @Test fun no_longer_ends_flags_requires_continuation() {
        val nearAllOut = genesis.copy(score = genesis.score.copy(wicketsLost = 9))
        val tenthWicket = dot().copy(
            wicket = WicketDetail(mode = DismissalMode.BOWLED, outBatterId = "A", endVacated = CreaseEnd.STRIKER, incomingBatterId = null),
        )
        val original = listOf(tenthWicket)
        val correctedToNotOut = dot() // the wicket turns out to have been a plain dot ball

        val outcome = correctDelivery(nearAllOut, original, 0, correctedToNotOut, battingContext, config)
        check(outcome is CorrectionOutcome.Applied)
        assertTrue(outcome.cascadeSummary.endTimingChange.requiresContinuation)
        assertNull(outcome.cascadeSummary.endTimingChange.orphanedDeliveryCount)
        assertNull(outcome.newState.inningsEndReason, "the corrected fold no longer reaches an end condition within the active deliveries it has")
    }

    // Neither sub-case fires when the innings' end-point is unaffected.
    @Test fun no_end_timing_change_when_ending_point_is_unaffected() {
        val nearAllOut = genesis.copy(score = genesis.score.copy(wicketsLost = 9))
        val tenthWicket = dot().copy(
            wicket = WicketDetail(mode = DismissalMode.BOWLED, outBatterId = "A", endVacated = CreaseEnd.STRIKER, incomingBatterId = null),
        )
        val original = listOf(tenthWicket)
        // Same dismissal, different mode only (still all-out either way).
        val correctedSameOutcome = tenthWicket.copy(
            wicket = tenthWicket.wicket!!.copy(mode = DismissalMode.LBW),
        )
        val outcome = correctDelivery(nearAllOut, original, 0, correctedSameOutcome, battingContext, config)
        check(outcome is CorrectionOutcome.Applied)
        assertNull(outcome.cascadeSummary.endTimingChange.orphanedDeliveryCount)
        assertTrue(!outcome.cascadeSummary.endTimingChange.requiresContinuation)
    }
}
