package com.kencric.scoring.ui.screens.ux05matchsetup

/**
 * TASK-0046: `ux-specification.md UX-05`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-05-match-setup/matchSetupForm.ts`
 * (`TASK-0045`) -- cross-platform parity (`C-7`) verified by mirroring
 * that file's own test cases exactly, same as `TASK-0041`/`0040`'s
 * precedent. Same contract-only scope note as `TASK-0041`: no Android
 * SDK/Gradle/Kotlin toolchain exists in this session, so this lives in
 * `shared/src/commonMain` rather than a fabricated `apps/android/`
 * path -- pure form logic, no Android API surface touched, a genuine
 * substitution point once a real Gradle project exists.
 */

enum class TieBreakerRule { SUPER_OVER, REPEAT, BOUNDARY_COUNTBACK, NONE }

data class Official(val name: String, val role: String)

data class MatchSetupFormState(
    val oversAllotted: Int? = null,
    val powerplayOvers: Int? = null,
    val bowlerOverCap: Int? = null,
    val tieBreakerRule: TieBreakerRule? = null,
    val venue: String? = null,
    val date: String? = null,
    val startTime: String? = null,
    val matchTimezone: String? = null,
    val officials: List<Official> = emptyList(),
    val minOversForResult: Int? = null,
)

fun initialMatchSetupState(): MatchSetupFormState = MatchSetupFormState()

data class FieldError(val field: String, val message: String)

/** B-B1: overs_allotted = 1 (smallest positive integer) accepted; overs_allotted = 0 rejected. */
fun validateOversAllotted(state: MatchSetupFormState): FieldError? {
    val overs = state.oversAllotted ?: return FieldError("oversAllotted", "Overs per innings is required")
    if (overs < 1) return FieldError("oversAllotted", "Overs per innings must be a positive integer")
    return null
}

fun validateMatchTimezone(state: MatchSetupFormState): FieldError? {
    if (state.matchTimezone.isNullOrBlank()) return FieldError("matchTimezone", "Match time zone is required")
    return null
}

/** I-B1: powerplayOvers > oversAllotted flags BOTH fields. */
fun validatePowerplayOvers(state: MatchSetupFormState): List<FieldError> {
    val powerplay = state.powerplayOvers ?: return emptyList()
    val errors = mutableListOf<FieldError>()
    if (powerplay < 1) errors.add(FieldError("powerplayOvers", "Powerplay overs must be a positive integer"))
    val overs = state.oversAllotted
    if (overs != null && powerplay > overs) {
        val message = "Powerplay overs cannot exceed overs per innings"
        errors.add(FieldError("powerplayOvers", message))
        errors.add(FieldError("oversAllotted", message))
    }
    return errors
}

fun validateBowlerOverCap(state: MatchSetupFormState): List<FieldError> {
    val cap = state.bowlerOverCap ?: return emptyList()
    val errors = mutableListOf<FieldError>()
    if (cap < 1) errors.add(FieldError("bowlerOverCap", "Bowler over cap must be a positive integer"))
    val overs = state.oversAllotted
    if (overs != null && cap > overs) {
        val message = "Bowler over cap cannot exceed overs per innings"
        errors.add(FieldError("bowlerOverCap", message))
        errors.add(FieldError("oversAllotted", message))
    }
    return errors
}

fun validateMinOversForResult(state: MatchSetupFormState): List<FieldError> {
    val minOvers = state.minOversForResult ?: return emptyList()
    val errors = mutableListOf<FieldError>()
    if (minOvers < 1) errors.add(FieldError("minOversForResult", "Minimum overs for result must be a positive integer"))
    val overs = state.oversAllotted
    if (overs != null && minOvers > overs) {
        val message = "Minimum overs for result cannot exceed overs per innings"
        errors.add(FieldError("minOversForResult", message))
        errors.add(FieldError("oversAllotted", message))
    }
    return errors
}

fun validateAll(state: MatchSetupFormState): List<FieldError> {
    val errors = mutableListOf<FieldError>()
    validateOversAllotted(state)?.let { errors.add(it) }
    validateMatchTimezone(state)?.let { errors.add(it) }
    errors.addAll(validatePowerplayOvers(state))
    errors.addAll(validateBowlerOverCap(state))
    errors.addAll(validateMinOversForResult(state))
    return errors
}

data class MustHaveChecklistItem(val field: String, val label: String, val complete: Boolean)

fun mustHaveChecklist(state: MatchSetupFormState): List<MustHaveChecklistItem> = listOf(
    MustHaveChecklistItem("oversAllotted", "Overs per innings", validateOversAllotted(state) == null),
    MustHaveChecklistItem("matchTimezone", "Match time zone", validateMatchTimezone(state) == null),
)

/** N-B1: Continue only once every Must-have field is present AND every cross-field check passes. */
fun canContinue(state: MatchSetupFormState): Boolean =
    mustHaveChecklist(state).all { it.complete } && validateAll(state).isEmpty()
