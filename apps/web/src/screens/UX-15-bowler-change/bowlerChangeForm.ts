/**
 * TASK-0065: `ux-specification.md UX-15` -- Bowler Change, guardrail-
 * enforcement layer.
 *
 * `live-scoring.md §4`'s guardrail preconditions (`BR-027`/`BR-028`)
 * have been explicitly out of scope for every task in this backlog
 * since `TASK-0017` (`OverState.kt`'s own comment: "§4's guardrails are
 * out of scope for every task in this backlog so far") -- this module
 * is the first real implementation of them, not a reuse of existing
 * `shared/` logic.
 *
 * CITATION NOTE: `UX-15`'s Trace `FR-054/055/056/057` are SRS-level and
 * correctly this screen's own territory (no collision, no gap this
 * time). `BR-027/028` are discovery-level -- SRS's own same-numbered
 * `BR-027/028` (dismissal attribution; extras/total-identity) are
 * unrelated.
 */

export interface BowlerCandidate {
  id: string;
  name: string;
  legalBallsBowled: number;
  runsCharged: number;
  wickets: number;
  maidens: number;
}

export type GuardrailRule = "CONSECUTIVE_OVER" | "OVER_LIMIT";

/**
 * `§4` rule 5: "not the immediately preceding over's bowler (`BR-027`)
 * and not already at `bowlerOverCap` (`BR-028`)." `B-D3`'s exact
 * boundary: `bowlerOverCap − 1` overs bowled is accepted, exactly
 * `bowlerOverCap` is blocked.
 */
export function guardrailBlocksFor(
  candidate: BowlerCandidate,
  previousOverBowlerId: string | null,
  bowlerOverCap: number | null,
  ballsPerOver: number,
): GuardrailRule[] {
  const blocks: GuardrailRule[] = [];
  if (previousOverBowlerId !== null && candidate.id === previousOverBowlerId) {
    blocks.push("CONSECUTIVE_OVER");
  }
  if (bowlerOverCap !== null) {
    const oversBowled = candidate.legalBallsBowled / ballsPerOver;
    if (oversBowled >= bowlerOverCap) {
      blocks.push("OVER_LIMIT");
    }
  }
  return blocks;
}

export function isGuardrailBlocked(candidate: BowlerCandidate, previousOverBowlerId: string | null, bowlerOverCap: number | null, ballsPerOver: number): boolean {
  return guardrailBlocksFor(candidate, previousOverBowlerId, bowlerOverCap, ballsPerOver).length > 0;
}

/** `UX-15`'s own Error-handling text: the specific rule stated plainly. */
export function guardrailMessage(rule: GuardrailRule): string {
  return rule === "CONSECUTIVE_OVER"
    ? "Same bowler can't bowl consecutive overs"
    : "This bowler has already reached the maximum overs allowed";
}

export type ConfirmResult = { outcome: "confirmed"; candidateId: string } | { outcome: "rejected"; reason: string };

/** `V10`: "overrideReason is non-empty whenever a guardrail override is in effect." */
export function confirmSelection(
  candidate: BowlerCandidate,
  blocks: readonly GuardrailRule[],
  overrideReason: string,
): ConfirmResult {
  if (blocks.length > 0 && overrideReason.trim() === "") {
    return { outcome: "rejected", reason: "An override requires a reason" };
  }
  return { outcome: "confirmed", candidateId: candidate.id };
}
