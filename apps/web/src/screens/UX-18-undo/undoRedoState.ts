/**
 * TASK-0071: `ux-specification.md UX-18` -- Undo, redo-window state-
 * machine layer.
 *
 * `shared/`'s existing `InningsFolder.undoLastDelivery(initialState,
 * deliveries, config)` (`fun undoLastDelivery(...) = foldInnings(
 * initialState, deliveries.dropLast(1), config)`) is the actual
 * reversal -- a one-line, already-tested, deterministic fold. This
 * module does not reimplement it; it manages the Available/Just-undone/
 * Redo-window state machine `UX-18`'s own text describes, generic over
 * the undone action's own shape (`T`) since this screen doesn't know a
 * delivery's internal structure.
 *
 * CITATION NOTE: `UX-18`'s Trace `FR-059/061/062` mixes SRS-level
 * `FR-059` ("Undo") with discovery-level `FR-061`/`FR-062` ("Undo"/
 * "Redo"). SRS has its own `FR-060` ("Redo an undone action," tracing
 * to discovery `FR-062`) that is never cited at all, even though its
 * discovery counterpart is -- flagged here, not silently added.
 */

export type UndoRedoState<T> =
  | { status: "UNAVAILABLE" }
  | { status: "AVAILABLE" }
  | { status: "JUST_UNDONE"; redoPayload: T }
  | { status: "GUARDRAIL_DISABLED" };

/** `UX-18`'s own Validation: "Undo is available only when a most-recent action exists to reverse." */
export function deriveBaseState<T>(hasRecentAction: boolean): UndoRedoState<T> {
  return hasRecentAction ? { status: "AVAILABLE" } : { status: "UNAVAILABLE" };
}

/** `UX-18`'s own States: "Disabled during a blocking guardrail modal." */
export function applyGuardrailOverlay<T>(state: UndoRedoState<T>, isGuardrailModalOpen: boolean): UndoRedoState<T> {
  if (isGuardrailModalOpen) return { status: "GUARDRAIL_DISABLED" };
  return state;
}

export function canUndo<T>(state: UndoRedoState<T>): boolean {
  return state.status === "AVAILABLE";
}

/** `UX-18`'s own Validation: "Redo is available only immediately after an Undo, before any new entry." */
export function canRedo<T>(state: UndoRedoState<T>): boolean {
  return state.status === "JUST_UNDONE";
}

export function performUndo<T>(state: UndoRedoState<T>, mostRecentAction: T): UndoRedoState<T> {
  if (state.status !== "AVAILABLE") return state;
  return { status: "JUST_UNDONE", redoPayload: mostRecentAction };
}

export type RedoResult<T> = { outcome: "redone"; payload: T; nextState: UndoRedoState<T> } | { outcome: "unavailable" };

export function performRedo<T>(state: UndoRedoState<T>): RedoResult<T> {
  if (state.status !== "JUST_UNDONE") {
    return { outcome: "unavailable" };
  }
  return { outcome: "redone", payload: state.redoPayload, nextState: { status: "AVAILABLE" } };
}

/** UX-18's own Validation: the Redo window closes the instant a new entry is recorded. */
export function onNewEntryRecorded<T>(): UndoRedoState<T> {
  return { status: "AVAILABLE" };
}

export type UndoOutcome = { outcome: "reversed" } | { outcome: "route-to-correction"; reason: string };

/**
 * `UX-18`'s own Error-handling text: "on the rare event Undo cannot
 * fully reverse a complex multi-part action, it opens that delivery in
 * Score Correction instead." `canFullyReverse` is caller-supplied --
 * `undoLastDelivery`'s own fold is complete and deterministic by
 * construction, so only the orchestration layer (which knows whether
 * "the last action" spans more than one delivery/event) can determine
 * when this escape hatch applies.
 */
export function attemptUndo(canFullyReverse: boolean): UndoOutcome {
  if (!canFullyReverse) {
    return { outcome: "route-to-correction", reason: "This action can't be fully undone here — opening Score Correction instead" };
  }
  return { outcome: "reversed" };
}
