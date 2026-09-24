package com.kencric.scoring.ui.screens.ux19matchpauseresume

/**
 * TASK-0074: `ux-specification.md UX-19`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-19-match-pause-resume/
 * matchPauseForm.ts` (`TASK-0073`) -- same contract-only scope note as
 * every earlier screen this session: no Android SDK/Gradle/Kotlin
 * toolchain exists, placed in `shared/commonMain` since this logic
 * touches no Android API surface at all.
 *
 * Confirmed genuinely unbuilt logic, not a reuse case -- see
 * `TASK-0073`'s own file for the full grounding and citation note
 * (`FR-064/078`'s two-distinct-rules-bundled-across-namespaces shape).
 */

enum class PauseReasonPreset { DRINKS, RAIN, BAD_LIGHT, INJURY }

sealed class PauseReason {
    data class Preset(val preset: PauseReasonPreset) : PauseReason()
    data class Other(val text: String) : PauseReason()
}

data class PauseRecord(
    val reason: PauseReason,
    val startTime: Long,
    val endTime: Long?,
)

enum class MatchPauseStatus { ACTIVE, PAUSED, RESUMING }

data class MatchPauseState(
    val status: MatchPauseStatus,
    val activePause: PauseRecord?,
)

fun initialMatchPauseState(): MatchPauseState = MatchPauseState(status = MatchPauseStatus.ACTIVE, activePause = null)

sealed class PauseResult {
    data class Paused(val state: MatchPauseState) : PauseResult()
    data class Rejected(val reason: String) : PauseResult()
}

/** UX-19's own Validation: "A reason is required to pause." */
fun confirmPause(state: MatchPauseState, reason: PauseReason, startTime: Long): PauseResult {
    if (state.status != MatchPauseStatus.ACTIVE) {
        return PauseResult.Rejected("Cannot pause — the match is not active")
    }
    if (reason is PauseReason.Other && reason.text.trim().isEmpty()) {
        return PauseResult.Rejected("A reason is required to pause")
    }
    return PauseResult.Paused(
        MatchPauseState(status = MatchPauseStatus.PAUSED, activePause = PauseRecord(reason, startTime, null))
    )
}

sealed class ResumeResult {
    data class Resumed(val state: MatchPauseState, val record: PauseRecord) : ResumeResult()
    data class Rejected(val reason: String) : ResumeResult()
}

/**
 * UX-19's own Validation: "Resume requires an active pause." An
 * accidental pause has an immediate, no-penalty Resume -- satisfied
 * structurally, no cooldown enforced.
 */
fun confirmResume(state: MatchPauseState, endTime: Long): ResumeResult {
    val activePause = state.activePause
    if (state.status != MatchPauseStatus.PAUSED || activePause == null) {
        return ResumeResult.Rejected("Resume requires an active pause")
    }
    val record = activePause.copy(endTime = endTime)
    return ResumeResult.Resumed(MatchPauseState(status = MatchPauseStatus.ACTIVE, activePause = null), record)
}

private fun presetLabel(preset: PauseReasonPreset): String = when (preset) {
    PauseReasonPreset.DRINKS -> "Drinks"
    PauseReasonPreset.RAIN -> "Rain"
    PauseReasonPreset.BAD_LIGHT -> "Bad light"
    PauseReasonPreset.INJURY -> "Injury"
}

/** UX-19's own Accessibility text: "an explicit 'Match paused: Rain' announcement." */
fun pauseAnnouncement(reason: PauseReason): String {
    val label = when (reason) {
        is PauseReason.Preset -> presetLabel(reason.preset)
        is PauseReason.Other -> reason.text
    }
    return "Match paused: $label"
}
