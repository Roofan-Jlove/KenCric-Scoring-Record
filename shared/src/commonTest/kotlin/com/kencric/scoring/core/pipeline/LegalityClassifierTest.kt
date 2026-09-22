package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.Legality
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Verifies classifyLegality against the LB✓/BF✓ columns of
 * live-scoring.md §21.2 (C01-C12, legal), §21.3 (C13-C16, wides), and
 * §21.4 (C17-C23, no-balls) -- every relevant case column, not the full
 * tables (their RunEvent totals/extras/rotation columns are out of this
 * task's scope; see LegalityClassifier.kt's own scope note).
 *
 * Cannot be executed in this environment -- no Kotlin toolchain exists.
 */
class LegalityClassifierTest {

    // §21.2 C01-C12: every legal-delivery case has LB✓=Yes, BF✓=Yes.
    @Test
    fun legal_delivery_consumes_slot_and_increments_balls_faced() {
        val result = classifyLegality(Legality.LEGAL)
        assertEquals(true, result.consumesLegalBallSlot, "§21.2 C01-C12: LB✓ = Yes for every legal delivery")
        assertEquals(true, result.incrementsStrikerBallsFaced, "§21.2 C01-C12: BF✓ = Yes for every legal delivery")
        assertEquals(true, result.incrementsBowlerLegalBalls, "§6.3: identical to the legal-ball-slot rule")
        assertEquals(false, result.isDeadBallShortCircuit)
    }

    // §21.3 C13-C16: every wide case has LB✓=No, BF✓=No.
    @Test
    fun wide_does_not_consume_slot_or_increment_balls_faced() {
        val result = classifyLegality(Legality.WIDE)
        assertEquals(false, result.consumesLegalBallSlot, "§21.3 C13-C16: LB✓ = No for every wide")
        assertEquals(false, result.incrementsStrikerBallsFaced, "§21.3 C13-C16: BF✓ = No for every wide")
        assertEquals(false, result.incrementsBowlerLegalBalls)
        assertEquals(false, result.isDeadBallShortCircuit)
    }

    // §21.4 C17-C23: every no-ball case has LB✓=No, BF✓=Yes -- the one
    // case where the two columns diverge, per §6.2's INV-008 note.
    @Test
    fun no_ball_does_not_consume_slot_but_does_increment_balls_faced() {
        val result = classifyLegality(Legality.NO_BALL)
        assertEquals(false, result.consumesLegalBallSlot, "§21.4 C17-C23: LB✓ = No for every no-ball")
        assertEquals(true, result.incrementsStrikerBallsFaced, "§21.4 C17-C23: BF✓ = Yes for every no-ball (INV-008)")
        assertEquals(false, result.incrementsBowlerLegalBalls)
        assertEquals(false, result.isDeadBallShortCircuit)
    }

    // §6.4: DEAD_BALL short-circuits everything.
    @Test
    fun dead_ball_short_circuits_and_touches_nothing() {
        val result = classifyLegality(Legality.DEAD_BALL)
        assertEquals(false, result.consumesLegalBallSlot)
        assertEquals(false, result.incrementsStrikerBallsFaced)
        assertEquals(false, result.incrementsBowlerLegalBalls)
        assertEquals(true, result.isDeadBallShortCircuit, "§6.4: DEAD_BALL short-circuits to event emission")
    }
}
