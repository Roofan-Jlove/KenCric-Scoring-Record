/**
 * TASK-0077: `ux-specification.md UX-21` -- Ball-by-Ball, delivery-
 * summary/filter/navigation layer.
 *
 * Confirmed genuinely unbuilt logic: no natural-language per-delivery
 * summary/description formatter exists anywhere in `shared/core`
 * (checked -- the only "summary" hits there are `InningsCorrector.kt`'s
 * own unrelated `CascadeSummary` doc comments). `shared/`'s existing
 * `MatchEvent`/`DeliveryInput` carry every fact a summary needs, but
 * nothing turns them into the one-line phrase this screen's own
 * Accessibility text names.
 *
 * Deliberately scoped to phrasing/filtering, not re-deriving facts from
 * raw event data: this module accepts an already-reduced
 * `DeliverySummaryInput` rather than mirroring the full `DeliveryInput`/
 * `RunEvent`/`WicketDetail` type graph into TypeScript -- those facts
 * are already known by the time this screen renders a row, produced by
 * pipeline stages this backlog has already built.
 */

export interface DeliverySummaryInput {
  overNumber: number;
  ballInOver: number;
  bowlerName: string;
  strikerName: string;
  runs: number;
  isBoundary: boolean;
  wicketDescription: string | null;
  extraDescription: string | null;
}

/** Same `O.B` display notation `TASK-0055`/`0065`/`0067`/`0075` already established. */
export function formatDeliveryOverBall(overNumber: number, ballInOver: number): string {
  return `${overNumber}.${ballInOver}`;
}

/**
 * `UX-21`'s own Accessibility text: "Over 12.4: Smith to Jones, four
 * runs, boundary." Flagged simplification: numerals rather than the
 * example's spelled-out "four," consistent with every earlier screen's
 * numeral convention.
 */
export function summarizeDelivery(input: DeliverySummaryInput): string {
  const overBall = formatDeliveryOverBall(input.overNumber, input.ballInOver);
  const parts = [`Over ${overBall}: ${input.bowlerName} to ${input.strikerName}`];
  if (input.wicketDescription !== null) {
    parts.push(input.wicketDescription);
  } else if (input.extraDescription !== null) {
    parts.push(input.extraDescription);
  } else if (input.runs === 0) {
    parts.push("dot ball");
  } else {
    parts.push(`${input.runs} run${input.runs === 1 ? "" : "s"}`);
    if (input.isBoundary) parts.push("boundary");
  }
  return parts.join(", ");
}

export interface DeliveryFilter {
  overRange: readonly [number, number] | null;
  bowlerId: string | null;
  batterId: string | null;
  phase: string | null;
}

export function initialDeliveryFilter(): DeliveryFilter {
  return { overRange: null, bowlerId: null, batterId: null, phase: null };
}

export interface FilterableDelivery {
  overNumber: number;
  bowlerId: string;
  strikerId: string;
  phase: string | null;
}

/** `UX-21`'s own Inputs: "Filters (over range, bowler, batter, phase)." */
export function matchesFilter(delivery: FilterableDelivery, filter: DeliveryFilter): boolean {
  if (filter.overRange !== null && (delivery.overNumber < filter.overRange[0] || delivery.overNumber > filter.overRange[1])) {
    return false;
  }
  if (filter.bowlerId !== null && delivery.bowlerId !== filter.bowlerId) return false;
  if (filter.batterId !== null && delivery.strikerId !== filter.batterId) return false;
  if (filter.phase !== null && delivery.phase !== filter.phase) return false;
  return true;
}

/** `UX-21`'s own States: "Filtered (active-filter chips shown)." */
export function hasActiveFilter(filter: DeliveryFilter): boolean {
  return filter.overRange !== null || filter.bowlerId !== null || filter.batterId !== null || filter.phase !== null;
}

export interface OverBallQuery {
  overNumber: number;
  ballInOver: number;
}

/** `UX-21`'s own Inputs: "a search/jump-to-over.ball field," accepting exactly the `O.B` notation this backlog has used since `TASK-0055`. */
export function parseOverBallQuery(query: string): OverBallQuery | null {
  const match = /^(\d+)\.(\d+)$/.exec(query.trim());
  if (!match) return null;
  return { overNumber: Number(match[1]), ballInOver: Number(match[2]) };
}

/** `UX-21`'s own States: "auto-scrolls to the newest ball unless the user has scrolled up, in which case a 'new ball ↓' affordance appears instead." */
export function shouldAutoScrollToNewest(hasUserScrolledUp: boolean): boolean {
  return !hasUserScrolledUp;
}
