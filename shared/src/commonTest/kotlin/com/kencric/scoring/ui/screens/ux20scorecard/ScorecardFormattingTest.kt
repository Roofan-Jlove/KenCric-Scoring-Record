package com.kencric.scoring.ui.screens.ux20scorecard

import com.kencric.scoring.core.model.BatterCardLine
import com.kencric.scoring.core.model.BatterStatus
import com.kencric.scoring.core.model.InningsScoreState
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * `TASK-0076`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-20-scorecard/scorecardFormatting.test.ts`
 * (`TASK-0075`) input-for-input, using the real imported
 * `core.model` types.
 */
class ScorecardFormattingTest {

    @Test fun formatStrikeRate_computes_runs_over_ballsFaced_times_100() {
        assertEquals(125.0, formatStrikeRate(50, 40))
    }

    @Test fun formatStrikeRate_is_null_at_zero_balls_faced() {
        assertNull(formatStrikeRate(0, 0))
    }

    @Test fun formatEconomy_computes_runsCharged_over_decimal_overs_bowled() {
        assertEquals(5.4, formatEconomy(18, 20, 6))
    }

    @Test fun formatEconomy_is_null_at_zero_legal_balls_bowled() {
        assertNull(formatEconomy(0, 0, 6))
    }

    // B-J1
    @Test fun hasBatted_is_true_for_a_real_card_line_even_at_0_runs_off_0_balls() {
        val duck = BatterCardLine(playerId = "p1", runs = 0, ballsFaced = 0, fours = 0, sixes = 0, status = BatterStatus.OUT)
        assertTrue(hasBatted(duck))
    }

    @Test fun hasBatted_is_false_for_a_batter_who_never_came_in() {
        assertFalse(hasBatted(null))
    }

    @Test fun formatExtrasLine_matches_the_literal_format_exactly() {
        val state = InningsScoreState(byes = 2, legByes = 1, wides = 5, noBalls = 1, penalty = 0)
        assertEquals("Extras (b 2, lb 1, w 5, nb 1, pen 0) = 9", formatExtrasLine(state))
    }

    @Test fun formatTotalLine_matches_the_literal_format_with_a_computed_run_rate() {
        val state = InningsScoreState(
            totalRuns = 150, byes = 2, legByes = 1, wides = 5, noBalls = 1, penalty = 0,
            wicketsLost = 4, legalBallsBowled = 120,
        )
        assertEquals("Total (4 wkts, 20.0 overs) 7.50 run rate", formatTotalLine(state, 6))
    }

    @Test fun formatTotalLine_shows_an_em_dash_run_rate_at_zero_legal_balls_bowled() {
        val state = InningsScoreState(totalRuns = 0, wicketsLost = 4, legalBallsBowled = 0)
        assertEquals("Total (4 wkts, 0.0 overs) — run rate", formatTotalLine(state, 6))
    }

    // N-J1 / INV-001
    @Test fun totalIdentityHolds_when_totalRuns_equals_the_sum_of_batter_runs_plus_extras() {
        val lines = listOf(
            BatterCardLine(playerId = "p1", runs = 50, ballsFaced = 40, fours = 4, sixes = 1, status = BatterStatus.NOT_OUT),
            BatterCardLine(playerId = "p2", runs = 92, ballsFaced = 70, fours = 8, sixes = 2, status = BatterStatus.OUT),
        )
        val state = InningsScoreState(totalRuns = 151, byes = 2, legByes = 1, wides = 5, noBalls = 1, penalty = 0)
        assertTrue(totalIdentityHolds(lines, state))
    }

    @Test fun totalIdentityHolds_is_false_when_inconsistent() {
        val lines = listOf(
            BatterCardLine(playerId = "p1", runs = 50, ballsFaced = 40, fours = 4, sixes = 1, status = BatterStatus.NOT_OUT),
        )
        val state = InningsScoreState(totalRuns = 999, byes = 2, legByes = 1, wides = 5, noBalls = 1, penalty = 0)
        assertFalse(totalIdentityHolds(lines, state))
    }
}
