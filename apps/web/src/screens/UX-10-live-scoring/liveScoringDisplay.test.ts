import { describe, expect, it } from "vitest";
import {
  computeBallsRemaining,
  computeRequiredRunRate,
  computeRunRate,
  computeRunsRequired,
  deriveScoringState,
  formatOvers,
  isChasing,
  oversAsDecimal,
} from "./liveScoringDisplay";

describe("formatOvers / oversAsDecimal -- RUN-013's O.B-notation-vs-decimal distinction", () => {
  it("formatOvers renders the O.B display notation, not a decimal", () => {
    expect(formatOvers(75, 6)).toBe("12.3");
  });

  it("oversAsDecimal computes the true decimal, NOT the O.B notation misread as a decimal", () => {
    // 75 legal balls at 6/over = 12 completed overs + 3 balls = 12.5 decimal overs, not 12.3.
    expect(oversAsDecimal(75, 6)).toBe(12.5);
  });

  it("a completed-over boundary formats with zero balls into the next over", () => {
    expect(formatOvers(72, 6)).toBe("12.0");
    expect(oversAsDecimal(72, 6)).toBe(12);
  });
});

describe("computeRunRate -- RUN-013", () => {
  it("computes runs / true-decimal-overs, not runs / O.B notation", () => {
    // 90 runs off 75 balls (12.5 decimal overs) = 7.2, NOT 90/12.3.
    expect(computeRunRate(90, 75, 6)).toBe(7.2);
  });

  it("is null (not a crash, not zero) at zero balls bowled", () => {
    expect(computeRunRate(0, 0, 6)).toBeNull();
  });
});

describe("computeRunsRequired / computeBallsRemaining / computeRequiredRunRate -- TGT-005", () => {
  it("computeRunsRequired is null in the first innings (no target set)", () => {
    expect(computeRunsRequired(null, 90)).toBeNull();
  });

  it("computeRunsRequired matches target minus current runs, floored at 0", () => {
    expect(computeRunsRequired(150, 90)).toBe(60);
    expect(computeRunsRequired(150, 160)).toBe(0);
  });

  it("computeBallsRemaining matches total allotted minus bowled, floored at 0", () => {
    expect(computeBallsRemaining(120, 75)).toBe(45);
    expect(computeBallsRemaining(120, 130)).toBe(0);
  });

  it("computeRequiredRunRate matches RUN-013: runs still required / overs remaining", () => {
    // 60 required off 45 balls remaining (7.5 decimal overs) = 8.
    expect(computeRequiredRunRate(60, 45, 6)).toBe(8);
  });

  it("computeRequiredRunRate is null with no target", () => {
    expect(computeRequiredRunRate(null, 45, 6)).toBeNull();
  });

  it("computeRequiredRunRate is null (not Infinity) with zero balls remaining", () => {
    expect(computeRequiredRunRate(10, 0, 6)).toBeNull();
  });
});

// SRS FR-063's own Acceptance bullet: "Given a live chase, when any delivery is recorded,
// then runs required and balls remaining update immediately and correctly."
describe("a live chase updates correctly delivery by delivery", () => {
  it("runs required and balls remaining both decrease after a scoring delivery", () => {
    const before = { runsRequired: computeRunsRequired(150, 90), ballsRemaining: computeBallsRemaining(120, 75) };
    // One legal delivery bowled, 4 runs scored.
    const after = { runsRequired: computeRunsRequired(150, 94), ballsRemaining: computeBallsRemaining(120, 76) };
    expect(after.runsRequired).toBeLessThan(before.runsRequired as number);
    expect(after.ballsRemaining).toBeLessThan(before.ballsRemaining);
  });
});

describe("deriveScoringState", () => {
  const base = {
    legalBallsBowled: 0,
    isBetweenOvers: false,
    isInningsBreak: false,
    isPaused: false,
    isReconciliationBlocked: false,
    isComplete: false,
  };

  it("PRE_FIRST_BALL when no legal balls have been bowled and nothing else applies", () => {
    expect(deriveScoringState(base)).toBe("PRE_FIRST_BALL");
  });

  it("ACTIVE once legal balls have been bowled and nothing else applies", () => {
    expect(deriveScoringState({ ...base, legalBallsBowled: 12 })).toBe("ACTIVE");
  });

  it("BETWEEN_OVERS takes priority over ACTIVE", () => {
    expect(deriveScoringState({ ...base, legalBallsBowled: 12, isBetweenOvers: true })).toBe("BETWEEN_OVERS");
  });

  it("PAUSED takes priority over BETWEEN_OVERS", () => {
    expect(deriveScoringState({ ...base, legalBallsBowled: 12, isBetweenOvers: true, isPaused: true })).toBe("PAUSED");
  });

  it("RECONCILIATION_BLOCKED takes priority over PAUSED", () => {
    expect(
      deriveScoringState({ ...base, legalBallsBowled: 12, isPaused: true, isReconciliationBlocked: true }),
    ).toBe("RECONCILIATION_BLOCKED");
  });

  it("COMPLETE takes priority over everything else", () => {
    expect(
      deriveScoringState({ ...base, legalBallsBowled: 12, isReconciliationBlocked: true, isComplete: true }),
    ).toBe("COMPLETE");
  });
});

describe("isChasing", () => {
  it("is false in the first innings even with a target present (defensive case)", () => {
    expect(isChasing(1, 150)).toBe(false);
  });

  it("is false in the second innings with no target set yet", () => {
    expect(isChasing(2, null)).toBe(false);
  });

  it("is true in the second innings once a target is set", () => {
    expect(isChasing(2, 150)).toBe(true);
  });
});
