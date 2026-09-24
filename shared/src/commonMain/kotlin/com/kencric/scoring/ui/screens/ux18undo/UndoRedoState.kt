package com.kencric.scoring.ui.screens.ux18undo

/**
 * TASK-0072: `ux-specification.md UX-18`'s own logic, ported field-for-
 * field from `apps/web/src/screens/UX-18-undo/undoRedoState.ts`
 * (`TASK-0071`) -- same contract-only scope note as every earlier
 * screen this session: no Android SDK/Gradle/Kotlin toolchain exists,
 * placed in `shared/commonMain` since this logic touches no Android API
 * surface at all.
 *
 * `core.pipeline.InningsFolder.undoLastDelivery` is the actual
 * reversal -- kept decoupled here the same way `TASK-0071`'s TS version
 * is, generic over the undone action's own type (`T`), consistent with
 * every other contract-only Android task's boundary (no live wiring to
 * the fold engine, that's integration/orchestration scope). See
 * `TASK-0071`'s own file for the citation note (`UX-18`'s missing
 * `FR-060` Redo citation).
 */

sealed class UndoRedoState<T> {
    class Unavailable<T> : UndoRedoState<T>()
    class Available<T> : UndoRedoState<T>()
    data class JustUndone<T>(val redoPayload: T) : UndoRedoState<T>()
    class GuardrailDisabled<T> : UndoRedoState<T>()
}

/** UX-18's own Validation: "Undo is available only when a most-recent action exists to reverse." */
fun <T> deriveBaseState(hasRecentAction: Boolean): UndoRedoState<T> =
    if (hasRecentAction) UndoRedoState.Available() else UndoRedoState.Unavailable()

/** UX-18's own States: "Disabled during a blocking guardrail modal." */
fun <T> applyGuardrailOverlay(state: UndoRedoState<T>, isGuardrailModalOpen: Boolean): UndoRedoState<T> =
    if (isGuardrailModalOpen) UndoRedoState.GuardrailDisabled() else state

fun <T> canUndo(state: UndoRedoState<T>): Boolean = state is UndoRedoState.Available

/** UX-18's own Validation: "Redo is available only immediately after an Undo, before any new entry." */
fun <T> canRedo(state: UndoRedoState<T>): Boolean = state is UndoRedoState.JustUndone

fun <T> performUndo(state: UndoRedoState<T>, mostRecentAction: T): UndoRedoState<T> =
    if (state !is UndoRedoState.Available) state else UndoRedoState.JustUndone(mostRecentAction)

sealed class RedoResult<T> {
    data class Redone<T>(val payload: T, val nextState: UndoRedoState<T>) : RedoResult<T>()
    class Unavailable<T> : RedoResult<T>()
}

fun <T> performRedo(state: UndoRedoState<T>): RedoResult<T> {
    if (state !is UndoRedoState.JustUndone) {
        return RedoResult.Unavailable()
    }
    return RedoResult.Redone(payload = state.redoPayload, nextState = UndoRedoState.Available())
}

/** UX-18's own Validation: the Redo window closes the instant a new entry is recorded. */
fun <T> onNewEntryRecorded(): UndoRedoState<T> = UndoRedoState.Available()

sealed class UndoOutcome {
    object Reversed : UndoOutcome()
    data class RouteToCorrection(val reason: String) : UndoOutcome()
}

/**
 * UX-18's own Error-handling text: "on the rare event Undo cannot fully
 * reverse a complex multi-part action, it opens that delivery in Score
 * Correction instead." `canFullyReverse` is caller-supplied.
 */
fun attemptUndo(canFullyReverse: Boolean): UndoOutcome =
    if (!canFullyReverse) {
        UndoOutcome.RouteToCorrection("This action can't be fully undone here — opening Score Correction instead")
    } else {
        UndoOutcome.Reversed
    }
