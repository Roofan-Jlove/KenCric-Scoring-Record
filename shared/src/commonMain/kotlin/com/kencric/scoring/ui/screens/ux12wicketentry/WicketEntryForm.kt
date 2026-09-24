package com.kencric.scoring.ui.screens.ux12wicketentry

import com.kencric.scoring.core.model.CreaseEnd
import com.kencric.scoring.core.model.DismissalMode
import com.kencric.scoring.core.model.FIELDER_REQUIRED_MODES
import com.kencric.scoring.core.model.Legality
import com.kencric.scoring.core.model.validDismissalModesFor

/**
 * TASK-0060: `ux-specification.md UX-12`'s own screen logic. Unlike
 * every earlier Android contract-only task this session, this one
 * IMPORTS the real, already-tested `core.model.{DismissalMode,
 * FIELDER_REQUIRED_MODES, Legality, validDismissalModesFor}` directly --
 * genuine Kotlin reuse, not a re-mirror -- since both live in the same
 * `shared/commonMain` source set. Only the screen-specific logic below
 * (not already in `core.model`) is new.
 *
 * See `TASK-0059`'s own file for the full citation note (`BR-030…033`
 * are discovery-level here, not SRS's own unrelated same-numbered
 * entries) and the `NON_STRIKER_RUN_OUT` scope note (not a real
 * `DismissalMode` value -- a pre-delivery mankad, `§9.6`, not yet built).
 */

/**
 * `TIMED_OUT`/`RETIRED_OUT` are "not tied to a delivery" per
 * `WicketDetail.kt`'s own comment, so `validDismissalModesFor`'s per-
 * legality/free-hit restriction doesn't apply to them -- always offered.
 * A flagged, interpretive bridge, not verbatim spec text (see
 * `TASK-0059`'s own file).
 */
fun modeIsOffered(mode: DismissalMode, legality: Legality, isFreeHit: Boolean): Boolean {
    if (mode == DismissalMode.TIMED_OUT || mode == DismissalMode.RETIRED_OUT) return true
    return mode in validDismissalModesFor(legality, isFreeHit)
}

/** UX-12's own Error handling: "a mode invalid for the current context... with a one-line reason available on request." */
fun reasonModeNotOffered(mode: DismissalMode, legality: Legality, isFreeHit: Boolean): String? {
    if (modeIsOffered(mode, legality, isFreeHit)) return null
    if (isFreeHit) return "Only run out, obstructing the field, or hit the ball twice are available on a free hit"
    if (legality == Legality.NO_BALL) return "Only run out, obstructing the field, or hit the ball twice are available off a no-ball"
    if (legality == Legality.WIDE && mode != DismissalMode.HIT_WICKET) return "Not available off a wide"
    if (legality == Legality.WIDE && mode == DismissalMode.HIT_WICKET) return "Not currently offered off a wide"
    if (legality == Legality.DEAD_BALL) return "No dismissal can be recorded on a dead ball"
    return "Not available in this context"
}

data class WicketFormState(
    val mode: DismissalMode? = null,
    val outBatterId: String? = null,
    val endVacated: CreaseEnd? = null,
    val fielderIds: List<String> = emptyList(),
    val crossedBeforeDismissal: Boolean? = null,
    val incomingBatterId: String? = null,
)

enum class RequiredField { FIELDER_IDS, CROSSED_BEFORE_DISMISSAL }

/** UX-12's own Validation: "Mode-specific required fields (e.g. caught requires a fielder; run out requires an end)." */
fun requiredFieldsForMode(mode: DismissalMode): List<RequiredField> {
    val fields = mutableListOf<RequiredField>()
    if (mode in FIELDER_REQUIRED_MODES) fields.add(RequiredField.FIELDER_IDS)
    if (mode == DismissalMode.RUN_OUT) fields.add(RequiredField.CROSSED_BEFORE_DISMISSAL)
    return fields
}

enum class MissingFieldKind { MODE, OUT_BATTER_ID, END_VACATED, FIELDER_IDS, CROSSED_BEFORE_DISMISSAL, INCOMING_BATTER_ID }

data class MissingField(val field: MissingFieldKind, val message: String)

/**
 * `endVacated` and `outBatterId` are always required (`WicketDetail`'s
 * own non-nullable fields); `incomingBatterId` is required unless the
 * caller says this dismissal ends the innings.
 */
fun missingFields(state: WicketFormState, endsInnings: Boolean): List<MissingField> {
    val missing = mutableListOf<MissingField>()
    val mode = state.mode
    if (mode == null) {
        missing.add(MissingField(MissingFieldKind.MODE, "Select a dismissal mode"))
        return missing
    }
    if (state.outBatterId == null) missing.add(MissingField(MissingFieldKind.OUT_BATTER_ID, "Select the out batter"))
    if (state.endVacated == null) missing.add(MissingField(MissingFieldKind.END_VACATED, "Select the end vacated"))
    for (field in requiredFieldsForMode(mode)) {
        if (field == RequiredField.FIELDER_IDS && state.fielderIds.isEmpty()) {
            missing.add(MissingField(MissingFieldKind.FIELDER_IDS, "Select the fielder"))
        }
        if (field == RequiredField.CROSSED_BEFORE_DISMISSAL && state.crossedBeforeDismissal == null) {
            missing.add(MissingField(MissingFieldKind.CROSSED_BEFORE_DISMISSAL, "Select whether the batters crossed"))
        }
    }
    if (!endsInnings && state.incomingBatterId == null) {
        missing.add(MissingField(MissingFieldKind.INCOMING_BATTER_ID, "Select the incoming batter"))
    }
    return missing
}

fun canConfirm(state: WicketFormState, endsInnings: Boolean): Boolean = missingFields(state, endsInnings).isEmpty()
