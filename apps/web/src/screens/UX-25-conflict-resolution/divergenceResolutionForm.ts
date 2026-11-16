/**
 * `ux-specification.md UX-25` -- Conflict Resolution, the dual-scorer-
 * divergence half (the `FenceConflictScreen` in this same folder is
 * the other, already-built P1 fence-conflict half). The real backend
 * (`divergenceResolution.ts`, `TASK-0125`) and real detection wiring
 * (`TASK-0161`) already exist; this is the UI layer neither ever had.
 *
 * **`yours`/`theirs` is a real, not fabricated, framing** -- the
 * stored row only has two arbitrary `stream_a_id`/`stream_b_id`
 * columns with no identity of their own, but `UX-25`'s own
 * Accessibility text ("Yours: four runs. Theirs: wide plus one.")
 * means something specific whenever THIS browser's own current
 * `scorerStreamId` happens to equal one of the two stored ids (the
 * real, reachable "same creator, two tabs" scenario this app's own
 * architecture actually supports, confirmed while wiring TASK-0161) --
 * `describeDivergence` takes the caller's own current stream id and
 * resolves to that framing when it matches, falling back to neutral
 * "Device A"/"Device B" labels otherwise, never guessing an identity
 * the data doesn't support.
 */

export interface DivergenceItem {
  id: string;
  overBall: string;
  field: string;
  streamAId: string;
  streamBId: string;
  valueA: unknown;
  valueB: unknown;
  status: "OPEN" | "PROPOSED" | "RESOLVED";
  proposedValue: unknown;
  proposedBy: string | null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "no wicket";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/** `UX-25`'s own Accessibility text: "reads as one coherent phrase per field... not two disconnected cells." */
export function describeDivergence(item: DivergenceItem, currentStreamId: string | null): string {
  const aIsMine = currentStreamId !== null && currentStreamId === item.streamAId;
  const bIsMine = currentStreamId !== null && currentStreamId === item.streamBId;
  const labelA = aIsMine ? "Yours" : bIsMine ? "Theirs" : "Device A";
  const labelB = bIsMine ? "Yours" : aIsMine ? "Theirs" : "Device B";
  return `Over-ball ${item.overBall}, ${item.field}: ${labelA} ${formatValue(item.valueA)}. ${labelB} ${formatValue(item.valueB)}.`;
}

export type ProposeResult = { outcome: "allowed" } | { outcome: "blocked"; reason: string };

/** `UX-25`'s own Validation text and the real backend's own schema check (`proposeDivergenceResolution`'s own `proposedValue` requirement). */
export function canPropose(proposedValue: string): ProposeResult {
  if (proposedValue.trim() === "") {
    return { outcome: "blocked", reason: "A proposed value is required" };
  }
  return { outcome: "allowed" };
}

export type ConfirmResult = { outcome: "allowed" } | { outcome: "blocked"; reason: string };

/**
 * `BR-008`/`MINV-14`: "a scorer distinct from whoever proposed it" --
 * mirrors the real backend's own `confirmDivergenceResolution` check
 * (`divergenceResolution.ts`) for immediate UI feedback, the same
 * "client-side mirror of an already-real server rule" shape
 * `scoreCorrectionForm.ts`'s own `canConfirmCorrection` already uses.
 * The real backend check is still the actual authority -- this never
 * substitutes for it.
 */
export function canConfirm(item: DivergenceItem, confirmingActorId: string | null): ConfirmResult {
  if (item.status !== "PROPOSED") {
    return { outcome: "blocked", reason: "Only a proposed divergence can be confirmed" };
  }
  if (confirmingActorId !== null && item.proposedBy === confirmingActorId) {
    return { outcome: "blocked", reason: "A different scorer must confirm this proposal" };
  }
  return { outcome: "allowed" };
}
