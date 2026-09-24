package com.kencric.scoring.ui.screens.ux11ballentry

/**
 * TASK-0058: `ux-specification.md UX-11`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-11-ball-entry/ballEntryForm.ts`
 * (`TASK-0057`) -- same contract-only scope note as `TASK-0041`/`0046`/
 * `0048`/`0050`/`0052`/`0054`/`0056`: no Android SDK/Gradle/Kotlin
 * toolchain exists in this session, placed in `shared/commonMain` since
 * this logic touches no Android API surface at all.
 *
 * See `TASK-0057`'s own file for the full scope note (this is a
 * composition/validation layer feeding the existing `shared/` pipeline,
 * not a second scoring engine) and the citation note (`FR-043/044/048/
 * 049/050`'s double-namespace citation of two real requirements).
 */

sealed class RunValueResult {
    data class Valid(val totalRuns: Int) : RunValueResult()
    data class Invalid(val reason: String) : RunValueResult()
}

/** UX-11's own Validation: "Run value within the primary 0–6 range (higher values composed via the overthrow add-on)." */
fun composeRunValue(primaryTap: Int, overthrowAddOn: Int): RunValueResult {
    if (primaryTap < 0 || primaryTap > 6) {
        return RunValueResult.Invalid("Primary tap value must be an integer between 0 and 6")
    }
    if (overthrowAddOn < 0) {
        return RunValueResult.Invalid("Overthrow add-on must be a non-negative integer")
    }
    return RunValueResult.Valid(primaryTap + overthrowAddOn)
}

/**
 * UX-11's own Error handling: "only rare, higher-consequence entries (a
 * large overthrow) get a lightweight confirm step." No numeric
 * threshold for "large" is defined anywhere in this corpus -- `threshold`
 * is a required caller-supplied parameter, not a hardcoded guess.
 */
fun requiresLightweightConfirm(overthrowAddOn: Int, threshold: Int): Boolean = overthrowAddOn > threshold

enum class BallEntryState { GUARDRAIL_BLOCKED, JUST_RECORDED, UNDO_AVAILABLE, READY }

data class BallEntryStateInputs(
    val isGuardrailModalOpen: Boolean,
    val justRecorded: Boolean,
    val undoAvailable: Boolean,
)

/**
 * Precedence -- guardrail-blocked > just-recorded > undo-available >
 * ready -- is this task's own explicit, flagged interpretation, not
 * verbatim spec text (see `TASK-0057`'s own file).
 */
fun deriveBallEntryState(inputs: BallEntryStateInputs): BallEntryState {
    if (inputs.isGuardrailModalOpen) return BallEntryState.GUARDRAIL_BLOCKED
    if (inputs.justRecorded) return BallEntryState.JUST_RECORDED
    if (inputs.undoAvailable) return BallEntryState.UNDO_AVAILABLE
    return BallEntryState.READY
}

/** UX-11's own Validation: "submission blocked only while an unrelated guardrail modal is open." */
fun canSubmit(state: BallEntryState): Boolean = state != BallEntryState.GUARDRAIL_BLOCKED
