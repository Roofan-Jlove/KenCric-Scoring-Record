/**
 * TASK-0051: `ux-specification.md UX-08` -- Toss.
 *
 * CITATION NOTE (see this task's own backlog entry for the full trail):
 * `UX-08`'s Trace line cites `FR-023`, which is the SRS's own renumbered
 * `FR-023` ("Toss capture and innings order," `Must/P1`) -- NOT
 * discovery's own `FR-023` ("Configure ball type/brand," `Should/P2`,
 * V2-tagged). The two share a number only by coincidence across two
 * different ID namespaces.
 */

export type TossWinner = "A" | "B";
export type TossDecision = "BAT" | "BOWL";

export interface TossState {
  winner: TossWinner | null;
  decision: TossDecision | null;
  confirmed: boolean;
}

export function initialTossState(): TossState {
  return { winner: null, decision: null, confirmed: false };
}

/** UX-08's own Validation: "Both fields required before Confirm enables." */
export function canConfirm(state: TossState): boolean {
  return state.winner !== null && state.decision !== null && !state.confirmed;
}

export type ConfirmResult = { outcome: "confirmed"; state: TossState } | { outcome: "rejected"; reason: string };

export function confirmToss(state: TossState): ConfirmResult {
  if (state.winner === null || state.decision === null) {
    return { outcome: "rejected", reason: "Select both toss winner and decision before confirming" };
  }
  if (state.confirmed) {
    return { outcome: "rejected", reason: "Toss already confirmed" };
  }
  return { outcome: "confirmed", state: { ...state, confirmed: true } };
}

export interface InningsOrder {
  battingFirst: TossWinner;
  chasingSide: TossWinner;
}

function otherSide(side: TossWinner): TossWinner {
  return side === "A" ? "B" : "A";
}

/**
 * `N-B2`: "Given a toss recorded as 'Team A elects to bat,' when
 * confirmed, then the chasing-innings side is set to Team B."
 */
export function deriveInningsOrder(winner: TossWinner, decision: TossDecision): InningsOrder {
  const battingFirst = decision === "BAT" ? winner : otherSide(winner);
  return { battingFirst, chasingSide: otherSide(battingFirst) };
}

export type EditAttemptResult = "allowed" | "requires-amendment";

/**
 * `isLocked` is caller-supplied -- this screen has no visibility into
 * `match_events` (whether a first ball has actually been recorded), the
 * same boundary `TASK-0044`/`0045` already flagged for their own locked
 * states.
 */
export function attemptEdit(isLocked: boolean): EditAttemptResult {
  return isLocked ? "requires-amendment" : "allowed";
}

export type AmendResult = { outcome: "amended"; state: TossState } | { outcome: "rejected"; reason: string };

/** UX-08's own Error handling: the amendment path requires a mandatory reason, not a flat refusal. */
export function amendToss(newWinner: TossWinner, newDecision: TossDecision, reason: string): AmendResult {
  if (reason.trim().length === 0) {
    return { outcome: "rejected", reason: "An amendment requires a reason" };
  }
  return { outcome: "amended", state: { winner: newWinner, decision: newDecision, confirmed: true } };
}
