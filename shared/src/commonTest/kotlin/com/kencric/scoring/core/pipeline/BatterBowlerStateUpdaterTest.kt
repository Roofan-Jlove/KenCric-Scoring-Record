package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.BatterCardLine
import com.kencric.scoring.core.model.BowlerCardLine
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.RunEvent
import com.kencric.scoring.core.model.RunEventMethod.AUTOMATIC
import com.kencric.scoring.core.model.RunEventMethod.BOUNDARY
import com.kencric.scoring.core.model.RunEventMethod.RUN
import com.kencric.scoring.core.model.RunEventOrigin.NO_BALL_BAT
import com.kencric.scoring.core.model.RunEventOrigin.NO_BALL_PENALTY
import com.kencric.scoring.core.model.RunEventOrigin.OFF_BAT
import com.kencric.scoring.core.model.RunEventOrigin.WIDE
import com.kencric.scoring.core.model.creditsBowler
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * live-scoring.md §10-§11 (Step 6/7), cross-checked by hand against every
 * §22 worked example that reports batter/bowler figures: EX-01, EX-02,
 * EX-03, EX-05, EX-06, EX-08. Each test traces that example's own stated
 * before/after numbers exactly, not just a representative case.
 */
class BatterBowlerStateUpdaterTest {

    private val strikerA = BatterCardLine(playerId = "A")
    private val bowlerX = BowlerCardLine(playerId = "X")

    // EX-01: dot ball -- ballsFaced/legalBallsBowled increment, nothing else.
    @Test fun ex01_plain_dot_ball() {
        val runEvents = emptyList<RunEvent>()
        val aggregate = aggregateRuns(runEvents)
        val classification = classifyLegality(Legality.LEGAL)

        val batter = updateBatterCardLine(strikerA, aggregate, classification.incrementsStrikerBallsFaced, runEvents)
        assertEquals(BatterCardLine("A", runs = 0, ballsFaced = 1, fours = 0, sixes = 0), batter)

        val bowler = updateBowlerCardLine(bowlerX, Legality.LEGAL, aggregate, classification.consumesLegalBallSlot, creditsWicketToBowler = false)
        assertEquals(BowlerCardLine("X", legalBallsBowled = 1, runsCharged = 0), bowler)
    }

    // EX-02: single -- runs/ballsFaced/legalBallsBowled/runsCharged all +1.
    @Test fun ex02_single_mid_over() {
        val runEvents = listOf(RunEvent(OFF_BAT, 1, RUN))
        val aggregate = aggregateRuns(runEvents)
        val classification = classifyLegality(Legality.LEGAL)

        val batter = updateBatterCardLine(strikerA, aggregate, classification.incrementsStrikerBallsFaced, runEvents)
        assertEquals(BatterCardLine("A", runs = 1, ballsFaced = 1), batter)

        val bowler = updateBowlerCardLine(bowlerX, Legality.LEGAL, aggregate, classification.consumesLegalBallSlot, creditsWicketToBowler = false)
        assertEquals(BowlerCardLine("X", legalBallsBowled = 1, runsCharged = 1), bowler)
    }

    // EX-03: boundary six -- runs+6, ballsFaced+1, sixes+1; bowler runsCharged+6.
    @Test fun ex03_boundary_six() {
        val runEvents = listOf(RunEvent(OFF_BAT, 6, BOUNDARY))
        val aggregate = aggregateRuns(runEvents)
        val classification = classifyLegality(Legality.LEGAL)

        val batter = updateBatterCardLine(strikerA, aggregate, classification.incrementsStrikerBallsFaced, runEvents)
        assertEquals(BatterCardLine("A", runs = 6, ballsFaced = 1, sixes = 1), batter)

        val bowler = updateBowlerCardLine(bowlerX, Legality.LEGAL, aggregate, classification.consumesLegalBallSlot, creditsWicketToBowler = false)
        assertEquals(BowlerCardLine("X", legalBallsBowled = 1, runsCharged = 6), bowler)
    }

    // C06 (§21.2)/§10: an ALL-RUN four (method=RUN, not BOUNDARY) must NOT
    // increment `fours` -- the one case this suite most needs to get right.
    @Test fun all_run_four_does_not_increment_fours_tally() {
        val runEvents = listOf(RunEvent(OFF_BAT, 4, RUN))
        val aggregate = aggregateRuns(runEvents)
        val batter = updateBatterCardLine(strikerA, aggregate, incrementsBallsFaced = true, runEvents)
        assertEquals(4, batter.runs)
        assertEquals(0, batter.fours, "an all-run four is not a boundary -- §10 explicitly distinguishes this from a struck four")
    }

    // EX-05: wide to the boundary -- batter wholly unaffected; bowler
    // legalBallsBowled unchanged, runsCharged/widesBowled both +4.
    @Test fun ex05_wide_to_the_boundary() {
        val runEvents = listOf(RunEvent(WIDE, 4, BOUNDARY))
        val aggregate = aggregateRuns(runEvents)
        val classification = classifyLegality(Legality.WIDE)

        val batter = updateBatterCardLine(strikerA, aggregate, classification.incrementsStrikerBallsFaced, runEvents)
        assertEquals(strikerA, batter, "a wide never touches the striker's card line (§6.2/§10)")

        val bowler = updateBowlerCardLine(bowlerX, Legality.WIDE, aggregate, classification.consumesLegalBallSlot, creditsWicketToBowler = false)
        assertEquals(BowlerCardLine("X", legalBallsBowled = 0, runsCharged = 4, widesBowled = 4), bowler)
    }

    // EX-06: no-ball hit for four -- batter runs+4/ballsFaced+1/fours+1;
    // bowler legalBallsBowled unchanged, runsCharged+5, noBallsBowled+1.
    @Test fun ex06_no_ball_hit_for_four() {
        val runEvents = listOf(RunEvent(NO_BALL_PENALTY, 1, AUTOMATIC), RunEvent(NO_BALL_BAT, 4, BOUNDARY))
        val aggregate = aggregateRuns(runEvents)
        val classification = classifyLegality(Legality.NO_BALL)

        val batter = updateBatterCardLine(strikerA, aggregate, classification.incrementsStrikerBallsFaced, runEvents)
        assertEquals(BatterCardLine("A", runs = 4, ballsFaced = 1, fours = 1), batter)

        val bowler = updateBowlerCardLine(bowlerX, Legality.NO_BALL, aggregate, classification.consumesLegalBallSlot, creditsWicketToBowler = false)
        assertEquals(BowlerCardLine("X", legalBallsBowled = 0, runsCharged = 5, noBallsBowled = 1), bowler)
    }

    // EX-08: caught -- dismissed batter's ballsFaced STILL increments;
    // bowler legalBallsBowled+1 and, since CAUGHT credits the bowler
    // (§9.4), wickets+1.
    @Test fun ex08_caught_dismissed_batter_still_counted_as_faced() {
        val runEvents = emptyList<RunEvent>()
        val aggregate = aggregateRuns(runEvents)
        val classification = classifyLegality(Legality.LEGAL)

        val batter = updateBatterCardLine(strikerA, aggregate, classification.incrementsStrikerBallsFaced, runEvents)
        assertEquals(BatterCardLine("A", runs = 0, ballsFaced = 1), batter)

        val bowler = updateBowlerCardLine(
            bowlerX, Legality.LEGAL, aggregate, classification.consumesLegalBallSlot,
            creditsWicketToBowler = creditsBowler(DismissalMode.CAUGHT),
        )
        assertEquals(BowlerCardLine("X", legalBallsBowled = 1, wickets = 1), bowler)
    }

    // EX-07: RUN_OUT never credits the bowler, free hit or not (§9.4).
    @Test fun ex07_run_out_never_credits_the_bowler() {
        val runEvents = listOf(RunEvent(OFF_BAT, 1, RUN))
        val aggregate = aggregateRuns(runEvents)
        val classification = classifyLegality(Legality.LEGAL)

        val bowler = updateBowlerCardLine(
            bowlerX, Legality.LEGAL, aggregate, classification.consumesLegalBallSlot,
            creditsWicketToBowler = creditsBowler(DismissalMode.RUN_OUT),
        )
        assertEquals(0, bowler.wickets)
        assertEquals(1, bowler.runsCharged)
    }

    @Test fun overs_bowled_display_formats_whole_and_remainder() {
        assertEquals("4.2", oversBowledDisplay(legalBallsBowled = 26, ballsPerOver = 6))
        assertEquals("0.0", oversBowledDisplay(legalBallsBowled = 0, ballsPerOver = 6))
    }
}
