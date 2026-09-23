package com.kencric.scoring.core.conformance

import com.kencric.scoring.core.model.BattingContext
import com.kencric.scoring.core.model.CreaseEnd
import com.kencric.scoring.core.model.DeliveryInput
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.AUTOMATIC
import com.kencric.scoring.core.model.RunEventMethod.BOUNDARY
import com.kencric.scoring.core.model.RunEventMethod.RUN
import com.kencric.scoring.core.model.RunEventOrigin.NO_BALL_PENALTY
import com.kencric.scoring.core.model.RunEventOrigin.OFF_BAT
import com.kencric.scoring.core.model.RunEventOrigin.WIDE
import com.kencric.scoring.core.model.ValidationRule
import com.kencric.scoring.core.model.WicketDetail
import com.kencric.scoring.core.pipeline.ExtrasCategory
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Proves `FixtureSchema.kt`'s check* functions themselves are correct,
 * using hand-constructed objects matching a representative sample of
 * the actual `specs/conformance/*.json` fixture content (not JSON
 * parsing, per that file's own "designed, not wired" note) -- C01, C02,
 * C05, C13, C16, and C50, one from each fixture kind/section this
 * sample touches.
 */
class FixtureSchemaTest {

    private val battingContext = BattingContext(
        battingXiPlayerIds = setOf("A", "B"),
        alreadyBattedPlayerIds = setOf("A", "B"),
        notOutPlayerIds = setOf("A", "B"),
    )

    // C01 (§21.2): dot ball.
    @Test fun c01_dot_ball() {
        val fixture = DeliveryOutcomeFixture(
            id = "C01", legality = Legality.LEGAL, runEvents = emptyList(),
            expected = DeliveryOutcomeExpectation(total = 0, batterRuns = 0, bowlerRunsCharged = 0, ranRuns = 0, rotates = false, consumesLegalBallSlot = true, incrementsBallsFaced = true),
        )
        assertTrue(checkDeliveryOutcome(fixture).isEmpty())
    }

    // C02 (§21.2): single -- rotates.
    @Test fun c02_single() {
        val fixture = DeliveryOutcomeFixture(
            id = "C02", legality = Legality.LEGAL, runEvents = listOf(RunEvent(OFF_BAT, 1, RUN)),
            expected = DeliveryOutcomeExpectation(total = 1, batterRuns = 1, bowlerRunsCharged = 1, ranRuns = 1, rotates = true, consumesLegalBallSlot = true, incrementsBallsFaced = true),
        )
        assertTrue(checkDeliveryOutcome(fixture).isEmpty())
    }

    // C05 (§21.2): boundary four -- ranRuns=0, no rotation.
    @Test fun c05_boundary_four() {
        val fixture = DeliveryOutcomeFixture(
            id = "C05", legality = Legality.LEGAL, runEvents = listOf(RunEvent(OFF_BAT, 4, BOUNDARY)),
            expected = DeliveryOutcomeExpectation(total = 4, batterRuns = 4, bowlerRunsCharged = 4, ranRuns = 0, rotates = false, consumesLegalBallSlot = true, incrementsBallsFaced = true),
        )
        assertTrue(checkDeliveryOutcome(fixture).isEmpty())
    }

    // C13 (§21.3): plain wide.
    @Test fun c13_plain_wide() {
        val fixture = DeliveryOutcomeFixture(
            id = "C13", legality = Legality.WIDE, runEvents = listOf(RunEvent(WIDE, 1, AUTOMATIC)),
            expected = DeliveryOutcomeExpectation(total = 1, extras = mapOf(ExtrasCategory.WIDES to 1), ranRuns = 0, rotates = false, consumesLegalBallSlot = false, incrementsBallsFaced = false),
        )
        assertTrue(checkDeliveryOutcome(fixture).isEmpty())
    }

    // C16 (§21.3): wide to the boundary -- total is 4, not 5 (§7.6 subsumption).
    @Test fun c16_wide_to_the_boundary_subsumes() {
        val fixture = DeliveryOutcomeFixture(
            id = "C16", legality = Legality.WIDE, runEvents = listOf(RunEvent(WIDE, 4, BOUNDARY)),
            expected = DeliveryOutcomeExpectation(total = 4, extras = mapOf(ExtrasCategory.WIDES to 4), ranRuns = 0, rotates = false, consumesLegalBallSlot = false, incrementsBallsFaced = false),
        )
        assertTrue(checkDeliveryOutcome(fixture).isEmpty())
    }

    // C31 (§21.7): clean bowled -- bowler credited.
    @Test fun c31_bowled_credits_the_bowler() {
        val fixture = DeliveryOutcomeFixture(
            id = "C31", legality = Legality.LEGAL, runEvents = emptyList(),
            wicket = WicketDetail(mode = DismissalMode.BOWLED, outBatterId = "A", endVacated = CreaseEnd.STRIKER),
            expected = DeliveryOutcomeExpectation(total = 0, bowlerCredited = true),
        )
        assertTrue(checkDeliveryOutcome(fixture).isEmpty())
    }

    // C36 (§21.7): run out -- bowler NOT credited.
    @Test fun c36_run_out_does_not_credit_the_bowler() {
        val fixture = DeliveryOutcomeFixture(
            id = "C36", legality = Legality.LEGAL, runEvents = emptyList(),
            wicket = WicketDetail(mode = DismissalMode.RUN_OUT, outBatterId = "A", endVacated = CreaseEnd.STRIKER, crossedBeforeDismissal = false),
            expected = DeliveryOutcomeExpectation(total = 0, bowlerCredited = false),
        )
        assertTrue(checkDeliveryOutcome(fixture).isEmpty())
    }

    // A deliberately wrong expectation must actually be caught -- proves
    // the checker isn't vacuously passing everything.
    @Test fun checker_actually_catches_a_wrong_expectation() {
        val fixture = DeliveryOutcomeFixture(
            id = "C02-wrong", legality = Legality.LEGAL, runEvents = listOf(RunEvent(OFF_BAT, 1, RUN)),
            expected = DeliveryOutcomeExpectation(total = 2), // deliberately wrong -- actual total is 1
        )
        val failures = checkDeliveryOutcome(fixture)
        assertTrue(failures.isNotEmpty(), "a wrong expectation must produce a failure, not pass silently")
    }

    // C50 (§21.9): STUMPED on a NO_BALL is rejected by V5.
    @Test fun c50_stumped_on_no_ball_rejected_by_v5() {
        val fixture = RejectionFixture(
            id = "C50",
            input = DeliveryInput(
                legality = Legality.NO_BALL, strikerBatterId = "A", nonStrikerBatterId = "B", bowlerId = "X", isFreeHit = false,
                runEvents = listOf(RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC)),
                wicket = WicketDetail(mode = DismissalMode.STUMPED, outBatterId = "A", endVacated = CreaseEnd.STRIKER, fielderIds = listOf("keeper")),
            ),
            expectedRule = ValidationRule.V5,
        )
        assertTrue(checkRejection(fixture, battingContext).isEmpty())
    }

    // The rejection checker must also catch a wrongly-specified rule.
    @Test fun checker_catches_wrong_expected_rule() {
        val fixture = RejectionFixture(
            id = "C50-wrong",
            input = DeliveryInput(
                legality = Legality.NO_BALL, strikerBatterId = "A", nonStrikerBatterId = "B", bowlerId = "X", isFreeHit = false,
                runEvents = listOf(RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC)),
                wicket = WicketDetail(mode = DismissalMode.STUMPED, outBatterId = "A", endVacated = CreaseEnd.STRIKER, fielderIds = listOf("keeper")),
            ),
            expectedRule = ValidationRule.V6, // wrong -- the real failure is V5
        )
        assertTrue(checkRejection(fixture, battingContext).isNotEmpty())
    }
}
