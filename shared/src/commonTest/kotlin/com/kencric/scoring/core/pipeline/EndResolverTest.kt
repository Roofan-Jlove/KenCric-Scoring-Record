package com.kencric.scoring.core.pipeline

import com.kencric.scoring.core.model.CreaseEnd
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.opposite
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * live-scoring.md §21.7 and §22.8. Honest scope note: C37/C38 involve a
 * run already completed before the dismissal (attempting a 2nd run),
 * which shifts crease geometry mid-delivery in a way this function's
 * simple (mode, dismissedBatterOriginalEnd, endVacated, crossed) model
 * doesn't fully reconstruct from the §21.7 table alone. Tested instead:
 * C31/C36 exactly as the table states, a representative not-crossed
 * case exercising C37's rule, and -- crucially -- EX-09 (§22.8), a fully
 * worked example that turns out to describe exactly this "1 run
 * completed, crossed on the 2nd" scenario with a precise stated outcome.
 * Traced by hand against EX-09's own text before being written here; it
 * matches exactly, which is the strongest confirmation this function has
 * -- not merely representative for the crossed case, verified.
 */
class EndResolverTest {

    // C31: clean bowled -- new batter takes striker's end, non-striker unaffected.
    @Test fun c31_bowled_new_batter_takes_strikers_end() {
        val result = resolveEndPositions(
            mode = DismissalMode.BOWLED,
            dismissedBatterOriginalEnd = CreaseEnd.STRIKER,
            endVacated = CreaseEnd.STRIKER,
        )
        assertEquals(CreaseEnd.STRIKER, result.newBatterEnd)
        assertEquals(CreaseEnd.NON_STRIKER, result.survivingBatterEnd)
    }

    // C36: run out, striker, no runs completed, not crossed -- non-striker
    // unaffected, new batter takes striker's end.
    @Test fun c36_run_out_not_crossed_no_runs() {
        val result = resolveEndPositions(
            mode = DismissalMode.RUN_OUT,
            dismissedBatterOriginalEnd = CreaseEnd.STRIKER,
            endVacated = CreaseEnd.STRIKER,
            crossedBeforeDismissal = false,
        )
        assertEquals(CreaseEnd.STRIKER, result.newBatterEnd)
        assertEquals(CreaseEnd.NON_STRIKER, result.survivingBatterEnd)
    }

    // Representative not-crossed case (same rule C37 exercises): the
    // survivor stays at their original end; new batter takes endVacated
    // as declared, trusted directly per rule 2a.
    @Test fun run_out_not_crossed_trusts_declared_end_vacated() {
        val result = resolveEndPositions(
            mode = DismissalMode.RUN_OUT,
            dismissedBatterOriginalEnd = CreaseEnd.NON_STRIKER,
            endVacated = CreaseEnd.STRIKER,
            crossedBeforeDismissal = false,
        )
        assertEquals(CreaseEnd.STRIKER, result.newBatterEnd, "trusts the declared endVacated directly")
        assertEquals(CreaseEnd.STRIKER, result.survivingBatterEnd, "survivor stays at their own original end")
    }

    // Representative crossed case (same rule C38 exercises): a clean
    // symmetric swap -- survivor takes the dismissed batter's original
    // end, new batter takes the survivor's original end.
    @Test fun run_out_crossed_is_a_symmetric_swap() {
        val result = resolveEndPositions(
            mode = DismissalMode.RUN_OUT,
            dismissedBatterOriginalEnd = CreaseEnd.STRIKER,
            endVacated = CreaseEnd.NON_STRIKER, // irrelevant to this branch -- not used when crossed
            crossedBeforeDismissal = true,
        )
        assertEquals(CreaseEnd.NON_STRIKER, result.newBatterEnd, "the survivor's original end -- opposite of where the dismissed batter started")
        assertEquals(CreaseEnd.STRIKER, result.survivingBatterEnd, "the survivor now occupies the dismissed batter's original end")
    }

    // live-scoring.md §22.8 EX-09, traced exactly (not just representative):
    // A (striker) and B (non-striker) attempt two runs; A is run out on
    // the 2nd, having already crossed with B. Confirmed by hand against
    // the worked example's own stated outcome before being written here.
    @Test fun ex09_run_out_crossed_matches_the_worked_example_exactly() {
        val result = resolveEndPositions(
            mode = DismissalMode.RUN_OUT,
            dismissedBatterOriginalEnd = CreaseEnd.STRIKER, // "A started at the striker's end"
            endVacated = CreaseEnd.STRIKER,
            crossedBeforeDismissal = true,
        )
        assertEquals(CreaseEnd.NON_STRIKER, result.newBatterEnd, "EX-09: \"C therefore comes in at the non-striker's end\"")
        assertEquals(CreaseEnd.STRIKER, result.survivingBatterEnd, "EX-09: \"B — not C — is the striker\"")
    }

    @Test fun opposite_is_a_true_involution() {
        assertEquals(CreaseEnd.NON_STRIKER, CreaseEnd.STRIKER.opposite())
        assertEquals(CreaseEnd.STRIKER, CreaseEnd.NON_STRIKER.opposite())
        assertEquals(CreaseEnd.STRIKER, CreaseEnd.STRIKER.opposite().opposite())
    }
}
