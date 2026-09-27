import { describe, expect, it } from "vitest";
import {
  formatEconomy,
  formatExtrasLine,
  formatOvers,
  formatStrikeRate,
  formatTotalLine,
  hasBatted,
  totalIdentityHolds,
  type BatterCardLine,
  type InningsScoreState,
} from "./scorecardFormatting";

describe("formatStrikeRate", () => {
  it("computes runs / ballsFaced * 100", () => {
    expect(formatStrikeRate(50, 40)).toBe(125);
  });

  it("is null (not 0 or a crash) at zero balls faced", () => {
    expect(formatStrikeRate(0, 0)).toBeNull();
  });
});

describe("formatEconomy", () => {
  it("computes runsCharged / decimal overs bowled", () => {
    // 18 runs off 20 legal balls at 6/over = 3.333... decimal overs -> 18/3.3333 = 5.4
    expect(formatEconomy(18, 20, 6)).toBeCloseTo(5.4, 5);
  });

  it("is null at zero legal balls bowled", () => {
    expect(formatEconomy(0, 0, 6)).toBeNull();
  });
});

// B-J1
describe("hasBatted", () => {
  it("is true for a real card line even at 0 runs off 0 balls (a genuine duck)", () => {
    const duck: BatterCardLine = { playerId: "p1", runs: 0, ballsFaced: 0, fours: 0, sixes: 0, status: "OUT" };
    expect(hasBatted(duck)).toBe(true);
  });

  it("is false for a batter who never came in", () => {
    expect(hasBatted(null)).toBe(false);
  });
});

describe("formatExtrasLine -- SCRD-007", () => {
  it("matches the literal format exactly", () => {
    expect(formatExtrasLine({ byes: 2, legByes: 1, wides: 5, noBalls: 1, penalty: 0 })).toBe(
      "Extras (b 2, lb 1, w 5, nb 1, pen 0) = 9",
    );
  });
});

describe("formatTotalLine -- SCRD-008", () => {
  const state: InningsScoreState = {
    totalRuns: 150,
    byes: 2,
    legByes: 1,
    wides: 5,
    noBalls: 1,
    penalty: 0,
    wicketsLost: 4,
    legalBallsBowled: 120,
  };

  it("matches the literal format with a computed run rate", () => {
    // 150 runs / 20 decimal overs = 7.5
    expect(formatTotalLine(state, 6)).toBe("Total (4 wkts, 20.0 overs) 7.50 run rate");
  });

  it("shows an em-dash run rate at zero legal balls bowled, not 0 or a crash", () => {
    expect(formatTotalLine({ ...state, totalRuns: 0, legalBallsBowled: 0 }, 6)).toBe("Total (4 wkts, 0.0 overs) — run rate");
  });
});

// N-J1 / INV-001
describe("totalIdentityHolds", () => {
  const lines: BatterCardLine[] = [
    { playerId: "p1", runs: 50, ballsFaced: 40, fours: 4, sixes: 1, status: "NOT_OUT" },
    { playerId: "p2", runs: 92, ballsFaced: 70, fours: 8, sixes: 2, status: "OUT" },
  ];
  const extras = { byes: 2, legByes: 1, wides: 5, noBalls: 1, penalty: 0 };

  it("holds when totalRuns equals the sum of batter runs plus extras", () => {
    expect(totalIdentityHolds(lines, { totalRuns: 151, ...extras })).toBe(true);
  });

  it("does not hold when totalRuns is inconsistent with the underlying figures", () => {
    expect(totalIdentityHolds(lines, { totalRuns: 999, ...extras })).toBe(false);
  });
});
