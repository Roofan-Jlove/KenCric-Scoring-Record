package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.*
import kotlin.test.Test
import kotlin.test.assertTrue
import kotlin.test.assertIs

/**
 * The six mandatory conformance cases from live-scoring.md §21.9, plus
 * additional coverage for the rules §21.9 doesn't exercise (V1/V2/V7/V8).
 * Standalone kotlin.test cases -- NOT yet wired into the fixture-loading
 * conformance harness (TASK-0031/0032, not built yet); that integration
 * is those tasks' scope, not this one's.
 *
 * Cannot be executed in this environment -- no Kotlin/Gradle toolchain
 * exists here at all (see TASK-0016's report). Written, not run.
 */
class DeliveryValidatorTest {

    private val emptyBattingContext = BattingContext(emptySet(), emptySet(), emptySet())

    private fun baseInput(legality: Legality = Legality.LEGAL) = DeliveryInput(
        legality = legality,
        strikerBatterId = "striker-1",
        nonStrikerBatterId = "non-striker-1",
        bowlerId = "bowler-1",
        isFreeHit = false,
    )

    // C50: wicket.mode = STUMPED on a NO_BALL delivery -> V5.
    @Test
    fun c50_stumped_on_no_ball_rejected_by_v5() {
        val input = baseInput(Legality.NO_BALL).copy(
            wicket = WicketDetail(
                mode = DismissalMode.STUMPED,
                outBatterId = "striker-1",
                endVacated = CreaseEnd.STRIKER,
            ),
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V5 })
    }

    // C51: wicket.mode = CAUGHT with runEvents = [OB:2:R] -> V6.
    @Test
    fun c51_caught_with_runs_rejected_by_v6() {
        val input = baseInput().copy(
            wicket = WicketDetail(
                mode = DismissalMode.CAUGHT,
                outBatterId = "striker-1",
                fielderIds = listOf("fielder-1"),
                endVacated = CreaseEnd.STRIKER,
            ),
            runEvents = listOf(RunEvent(RunEventOrigin.OFF_BAT, 2, RunEventMethod.RUN)),
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V6 })
    }

    // C52: RunEvents = [OB:4:B, OB:2:O] on one delivery -> V4.
    @Test
    fun c52_boundary_and_overthrow_rejected_by_v4() {
        val input = baseInput().copy(
            runEvents = listOf(
                RunEvent(RunEventOrigin.OFF_BAT, 4, RunEventMethod.BOUNDARY),
                RunEvent(RunEventOrigin.OFF_BAT, 2, RunEventMethod.OVERTHROW),
            ),
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V4 })
    }

    // C53: legality = DEAD_BALL with a non-empty runEvents -> V11.
    @Test
    fun c53_dead_ball_with_runs_rejected_by_v11() {
        val input = baseInput(Legality.DEAD_BALL).copy(
            runEvents = listOf(RunEvent(RunEventOrigin.OFF_BAT, 1, RunEventMethod.RUN)),
            deadBallReason = "ball fell out of hand",
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V11 })
    }

    // C54: isFreeHit = true together with legality = NO_BALL -> V9.
    @Test
    fun c54_free_hit_on_no_ball_rejected_by_v9() {
        val input = baseInput(Legality.NO_BALL).copy(isFreeHit = true)
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V9 })
    }

    // C55: shortRuns = 2 when the only RUN-method value is 1 -> V3.
    @Test
    fun c55_excess_short_runs_rejected_by_v3() {
        val input = baseInput().copy(
            runEvents = listOf(RunEvent(RunEventOrigin.OFF_BAT, 1, RunEventMethod.RUN)),
            shortRuns = 2,
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V3 })
    }

    // Additional coverage beyond §21.9's mandatory six:

    @Test
    fun valid_legal_delivery_with_no_wicket_passes() {
        val input = baseInput().copy(
            runEvents = listOf(RunEvent(RunEventOrigin.OFF_BAT, 4, RunEventMethod.BOUNDARY)),
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Valid>(result)
    }

    // V2: an invalid (origin, method) pair.
    @Test
    fun invalid_origin_method_pair_rejected_by_v2() {
        val input = baseInput().copy(
            runEvents = listOf(RunEvent(RunEventOrigin.PENALTY, 5, RunEventMethod.RUN)),
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V2 })
    }

    // V7: CAUGHT with no fielderIds.
    @Test
    fun caught_with_no_fielder_rejected_by_v7() {
        val input = baseInput().copy(
            wicket = WicketDetail(
                mode = DismissalMode.CAUGHT,
                outBatterId = "striker-1",
                fielderIds = emptyList(),
                endVacated = CreaseEnd.STRIKER,
            ),
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V7 })
    }

    // V8: an incoming batter who isn't in the XI at all.
    @Test
    fun incoming_batter_not_in_xi_rejected_by_v8() {
        val input = baseInput().copy(
            wicket = WicketDetail(
                mode = DismissalMode.BOWLED,
                outBatterId = "striker-1",
                endVacated = CreaseEnd.STRIKER,
                incomingBatterId = "not-in-xi",
            ),
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V8 })
    }

    @Test
    fun incoming_batter_valid_in_xi_passes_v8() {
        val context = BattingContext(
            battingXiPlayerIds = setOf("next-batter"),
            alreadyBattedPlayerIds = emptySet(),
            notOutPlayerIds = setOf("next-batter"),
        )
        val input = baseInput().copy(
            wicket = WicketDetail(
                mode = DismissalMode.BOWLED,
                outBatterId = "striker-1",
                endVacated = CreaseEnd.STRIKER,
                incomingBatterId = "next-batter",
            ),
        )
        val result = validateDelivery(input, context)
        assertIs<ValidationResult.Valid>(result)
    }

    // A free hit's restricted dismissal-mode set (V5, not in §21.9's
    // mandatory six but directly exercising §9.1's free-hit row).
    @Test
    fun bowled_on_free_hit_rejected_by_v5() {
        val input = baseInput().copy(
            isFreeHit = true,
            wicket = WicketDetail(
                mode = DismissalMode.BOWLED,
                outBatterId = "striker-1",
                endVacated = CreaseEnd.STRIKER,
            ),
        )
        val result = validateDelivery(input, emptyBattingContext)
        assertIs<ValidationResult.Invalid>(result)
        assertTrue(result.failures.any { it.rule == ValidationRule.V5 })
    }
}
