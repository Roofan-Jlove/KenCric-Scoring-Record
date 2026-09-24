import { describe, expect, it } from "vitest";
import { confirmSelection, guardrailBlocksFor, guardrailMessage, isGuardrailBlocked, type BowlerCandidate } from "./bowlerChangeForm";

function candidate(overrides: Partial<BowlerCandidate> = {}): BowlerCandidate {
  return { id: "bowler-1", name: "J. Smith", legalBallsBowled: 0, runsCharged: 0, wickets: 0, maidens: 0, ...overrides };
}

// BR-027
describe("guardrailBlocksFor -- consecutive over", () => {
  it("blocks the immediately preceding over's bowler", () => {
    const blocks = guardrailBlocksFor(candidate({ id: "bowler-1" }), "bowler-1", null, 6);
    expect(blocks).toContain("CONSECUTIVE_OVER");
  });

  it("does not block a candidate who did not bowl the previous over", () => {
    const blocks = guardrailBlocksFor(candidate({ id: "bowler-2" }), "bowler-1", null, 6);
    expect(blocks).not.toContain("CONSECUTIVE_OVER");
  });

  it("does not block anyone when there was no previous over (first over of the innings)", () => {
    const blocks = guardrailBlocksFor(candidate({ id: "bowler-1" }), null, null, 6);
    expect(blocks).not.toContain("CONSECUTIVE_OVER");
  });
});

// BR-028 / B-D3
describe("guardrailBlocksFor -- over limit (B-D3)", () => {
  it("B-D3: a bowler at exactly bowlerOverCap - 1 overs bowled is accepted", () => {
    // bowlerOverCap=4, so 3 overs bowled (18 legal balls at 6/over) is one under the cap.
    const blocks = guardrailBlocksFor(candidate({ legalBallsBowled: 18 }), null, 4, 6);
    expect(blocks).not.toContain("OVER_LIMIT");
  });

  it("B-D3: a bowler at exactly bowlerOverCap overs bowled is blocked", () => {
    // 4 overs bowled (24 legal balls) exactly at the cap.
    const blocks = guardrailBlocksFor(candidate({ legalBallsBowled: 24 }), null, 4, 6);
    expect(blocks).toContain("OVER_LIMIT");
  });

  it("no cap configured never blocks on over-limit", () => {
    const blocks = guardrailBlocksFor(candidate({ legalBallsBowled: 1000 }), null, null, 6);
    expect(blocks).not.toContain("OVER_LIMIT");
  });

  it("a bowler can be blocked by both guardrails simultaneously", () => {
    const blocks = guardrailBlocksFor(candidate({ id: "bowler-1", legalBallsBowled: 24 }), "bowler-1", 4, 6);
    expect(blocks).toEqual(expect.arrayContaining(["CONSECUTIVE_OVER", "OVER_LIMIT"]));
  });
});

describe("isGuardrailBlocked", () => {
  it("mirrors guardrailBlocksFor's own emptiness", () => {
    expect(isGuardrailBlocked(candidate({ id: "bowler-2" }), "bowler-1", null, 6)).toBe(false);
    expect(isGuardrailBlocked(candidate({ id: "bowler-1" }), "bowler-1", null, 6)).toBe(true);
  });
});

describe("guardrailMessage", () => {
  it("states the specific rule plainly", () => {
    expect(guardrailMessage("CONSECUTIVE_OVER")).toContain("consecutive");
    expect(guardrailMessage("OVER_LIMIT")).toContain("maximum overs");
  });
});

// V10
describe("confirmSelection", () => {
  it("an unblocked candidate confirms with no reason required", () => {
    const result = confirmSelection(candidate(), [], "");
    expect(result).toEqual({ outcome: "confirmed", candidateId: "bowler-1" });
  });

  it("a blocked candidate is rejected with a blank override reason", () => {
    const result = confirmSelection(candidate(), ["CONSECUTIVE_OVER"], "   ");
    expect(result.outcome).toBe("rejected");
  });

  it("a blocked candidate confirms with a non-blank override reason", () => {
    const result = confirmSelection(candidate(), ["OVER_LIMIT"], "No other bowlers fit for purpose");
    expect(result).toEqual({ outcome: "confirmed", candidateId: "bowler-1" });
  });
});
