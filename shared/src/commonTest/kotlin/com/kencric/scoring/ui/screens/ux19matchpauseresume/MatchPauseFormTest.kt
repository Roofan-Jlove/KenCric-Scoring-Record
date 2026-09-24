package com.kencric.scoring.ui.screens.ux19matchpauseresume

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * `TASK-0074`, cross-platform parity (`C-7`): mirrors
 * `apps/web/src/screens/UX-19-match-pause-resume/matchPauseForm.test.ts`
 * (`TASK-0073`) input-for-input.
 */
class MatchPauseFormTest {

    private val drinks = PauseReason.Preset(PauseReasonPreset.DRINKS)

    @Test fun pauses_successfully_with_a_preset_reason() {
        val result = confirmPause(initialMatchPauseState(), drinks, 1000)
        assertTrue(result is PauseResult.Paused)
        val state = (result as PauseResult.Paused).state
        assertEquals(MatchPauseStatus.PAUSED, state.status)
        assertEquals(PauseRecord(drinks, 1000, null), state.activePause)
    }

    @Test fun pauses_successfully_with_non_blank_free_text_other_reason() {
        val reason = PauseReason.Other("Power outage")
        val result = confirmPause(initialMatchPauseState(), reason, 1000)
        assertTrue(result is PauseResult.Paused)
    }

    @Test fun rejects_a_blank_free_text_other_reason() {
        val reason = PauseReason.Other("   ")
        val result = confirmPause(initialMatchPauseState(), reason, 1000)
        assertTrue(result is PauseResult.Rejected)
        assertEquals("A reason is required to pause", (result as PauseResult.Rejected).reason)
    }

    @Test fun rejects_pausing_when_not_currently_active() {
        val paused = confirmPause(initialMatchPauseState(), drinks, 1000) as PauseResult.Paused
        val secondAttempt = confirmPause(paused.state, drinks, 2000)
        assertTrue(secondAttempt is PauseResult.Rejected)
    }

    @Test fun rejects_resuming_from_the_active_non_paused_state() {
        val result = confirmResume(initialMatchPauseState(), 1000)
        assertTrue(result is ResumeResult.Rejected)
        assertEquals("Resume requires an active pause", (result as ResumeResult.Rejected).reason)
    }

    @Test fun resumes_successfully_from_an_active_pause_recording_the_end_time() {
        val paused = confirmPause(initialMatchPauseState(), drinks, 1000) as PauseResult.Paused
        val result = confirmResume(paused.state, 5000)
        assertTrue(result is ResumeResult.Resumed)
        val resumed = result as ResumeResult.Resumed
        assertEquals(MatchPauseState(MatchPauseStatus.ACTIVE, null), resumed.state)
        assertEquals(PauseRecord(drinks, 1000, 5000), resumed.record)
    }

    @Test fun an_accidental_pause_has_an_immediate_no_penalty_resume() {
        val paused = confirmPause(initialMatchPauseState(), drinks, 1000) as PauseResult.Paused
        val result = confirmResume(paused.state, 1001)
        assertTrue(result is ResumeResult.Resumed)
    }

    @Test fun announces_a_preset_reason_by_its_label() {
        assertEquals("Match paused: Drinks", pauseAnnouncement(drinks))
        assertEquals("Match paused: Rain", pauseAnnouncement(PauseReason.Preset(PauseReasonPreset.RAIN)))
    }

    @Test fun announces_free_text_other_reasons_verbatim() {
        assertEquals("Match paused: Power outage", pauseAnnouncement(PauseReason.Other("Power outage")))
    }
}
