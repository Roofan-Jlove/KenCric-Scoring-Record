package com.kencric.scoring.ui.screens.ux13extras

/**
 * TASK-0062: `ux-specification.md UX-13`'s own screen logic, ported
 * field-for-field from `apps/web/src/screens/UX-13-extras/
 * extrasForm.ts` (`TASK-0061`) -- same contract-only scope note as
 * every earlier screen this session: no Android SDK/Gradle/Kotlin
 * toolchain exists, placed in `shared/commonMain` since this logic
 * touches no Android API surface at all.
 *
 * This screen's output feeds `shared/`'s existing
 * `core.pipeline.ExtrasDecomposer` (`TASK-0020`) -- not reimplemented
 * here. See `TASK-0061`'s own file for the full citation note
 * (`FR-044/046/047` confirmed as `UX-13`'s real territory; the missing
 * `FR-045` gap; `BR-034/035/036` as discovery-level numbers).
 */

enum class ExtraType { WIDE, NO_BALL, BYE, LEG_BYE, PENALTY }

enum class PenaltyRecipientSide { BATTING, BOWLING }

data class ExtrasFormState(
    val type: ExtraType? = null,
    val additionalRuns: Int = 0,
    val penaltyReason: String = "",
    val penaltyRecipientSide: PenaltyRecipientSide? = null,
)

fun initialExtrasFormState(): ExtrasFormState = ExtrasFormState()

/**
 * `BR-034`/`BR-035`: byes/leg-byes count as legal deliveries; wides/no-
 * balls do not. Penalty is `false` "by default" per `DR-16`'s config-
 * dependent framing -- a flagged simplification.
 */
fun consumesLegalBall(type: ExtraType): Boolean = type == ExtraType.BYE || type == ExtraType.LEG_BYE

/** UX-13's own Validation: a type disabled by the current playing-conditions profile is shown but not selectable. `enabledTypes` is caller-supplied. */
fun isTypeEnabled(type: ExtraType, enabledTypes: Set<ExtraType>): Boolean = type in enabledTypes

sealed class SubmitResult {
    data class Valid(val state: ExtrasFormState) : SubmitResult()
    data class Invalid(val reason: String) : SubmitResult()
}

/** `BR-036`: a penalty requires a reason. Also enforces the recipient side and a non-negative additional-runs value for every type. */
fun validateSubmission(state: ExtrasFormState): SubmitResult {
    if (state.type == null) {
        return SubmitResult.Invalid("Select an extra type")
    }
    if (state.additionalRuns < 0) {
        return SubmitResult.Invalid("Additional runs must be a non-negative integer")
    }
    if (state.type == ExtraType.PENALTY) {
        if (state.penaltyReason.trim().isEmpty()) {
            return SubmitResult.Invalid("A penalty requires a reason")
        }
        if (state.penaltyRecipientSide == null) {
            return SubmitResult.Invalid("Select the penalty recipient side")
        }
    }
    return SubmitResult.Valid(state)
}
