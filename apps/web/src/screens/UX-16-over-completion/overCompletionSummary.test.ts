import { describe, expect, it } from "vitest";
import { formatBowlerFigures, formatOvers, type BowlerFigures } from "./overCompletionSummary";

describe("formatOvers -- O.B display notation", () => {
  it("formats completed overs plus balls into the current over", () => {
    expect(formatOvers(20, 6)).toBe("3.2");
  });

  it("formats a completed-over boundary with zero balls into the next over", () => {
    expect(formatOvers(18, 6)).toBe("3.0");
  });
});

describe("formatBowlerFigures", () => {
  it("formats a full figures line with correct pluralization", () => {
    const figures: BowlerFigures = { legalBallsBowled: 20, runsCharged: 18, wickets: 1, maidens: 0 };
    expect(formatBowlerFigures(figures, 6)).toBe("3.2 overs, 0 maidens, 18 runs, 1 wicket");
  });

  it("singularizes exactly-one values correctly", () => {
    const figures: BowlerFigures = { legalBallsBowled: 6, runsCharged: 1, wickets: 1, maidens: 1 };
    expect(formatBowlerFigures(figures, 6)).toBe("1.0 overs, 1 maiden, 1 run, 1 wicket");
  });

  it("formats a maiden over with zero runs charged", () => {
    const figures: BowlerFigures = { legalBallsBowled: 6, runsCharged: 0, wickets: 0, maidens: 1 };
    expect(formatBowlerFigures(figures, 6)).toBe("1.0 overs, 1 maiden, 0 runs, 0 wickets");
  });
});
