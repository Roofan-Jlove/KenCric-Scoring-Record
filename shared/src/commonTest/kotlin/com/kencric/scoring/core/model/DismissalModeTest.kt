package com.kencric.scoring.core.model

import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * TASK-0021: verifies creditsBowler() against every §21.7 case
 * (C31-C44's "Bowler credit" column), plus re-confirms the mode-validity
 * matrix (validDismissalModesFor, TASK-0017) already covers this task's
 * named goal -- not re-implemented here, only cross-checked.
 */
class DismissalModeTest {

    @Test fun bowler_credited_modes() {
        // C31, C32/C33 (caught, incl. caught-and-bowled), C34, C35, C39.
        assertEquals(true, creditsBowler(DismissalMode.BOWLED))
        assertEquals(true, creditsBowler(DismissalMode.CAUGHT))
        assertEquals(true, creditsBowler(DismissalMode.LBW))
        assertEquals(true, creditsBowler(DismissalMode.STUMPED))
        assertEquals(true, creditsBowler(DismissalMode.HIT_WICKET))
    }

    @Test fun not_bowler_credited_modes() {
        // C36-C38 (run out), C40, C41, C42 (mankad, also RUN_OUT), C43, C44.
        assertEquals(false, creditsBowler(DismissalMode.RUN_OUT))
        assertEquals(false, creditsBowler(DismissalMode.OBSTRUCTING_THE_FIELD))
        assertEquals(false, creditsBowler(DismissalMode.HIT_BALL_TWICE))
        assertEquals(false, creditsBowler(DismissalMode.TIMED_OUT))
        assertEquals(false, creditsBowler(DismissalMode.RETIRED_OUT))
    }

    // C33: "caught and bowled" is not a distinct mode -- CAUGHT with
    // fielderIds=[bowlerId], still bowler-credited, no special handling
    // (§9.2's own note, already the case since creditsBowler is a
    // function of mode alone and doesn't inspect fielderIds at all).
    @Test fun caught_and_bowled_is_still_bowler_credited() {
        assertEquals(true, creditsBowler(DismissalMode.CAUGHT))
    }

    // Re-confirms TASK-0021's own named goal (mode-validity-by-legality)
    // is already satisfied by TASK-0017's validDismissalModesFor -- e.g.
    // STUMPED valid off a legal delivery, invalid off a no-ball.
    @Test fun mode_validity_matrix_already_covers_this_tasks_named_goal() {
        assertEquals(
            true,
            DismissalMode.STUMPED in validDismissalModesFor(Legality.LEGAL, isFreeHit = false),
        )
        assertEquals(
            false,
            DismissalMode.STUMPED in validDismissalModesFor(Legality.NO_BALL, isFreeHit = false),
        )
    }
}
