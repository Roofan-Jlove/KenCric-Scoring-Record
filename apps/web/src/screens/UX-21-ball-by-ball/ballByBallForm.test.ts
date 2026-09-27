import { describe, expect, it } from "vitest";
import {
  formatDeliveryOverBall,
  hasActiveFilter,
  initialDeliveryFilter,
  matchesFilter,
  parseOverBallQuery,
  shouldAutoScrollToNewest,
  summarizeDelivery,
  type DeliverySummaryInput,
  type FilterableDelivery,
} from "./ballByBallForm";

function baseInput(overrides: Partial<DeliverySummaryInput> = {}): DeliverySummaryInput {
  return {
    overNumber: 12,
    ballInOver: 4,
    bowlerName: "Smith",
    strikerName: "Jones",
    runs: 0,
    isBoundary: false,
    wicketDescription: null,
    extraDescription: null,
    ...overrides,
  };
}

describe("formatDeliveryOverBall", () => {
  it("formats over.ball exactly", () => {
    expect(formatDeliveryOverBall(12, 4)).toBe("12.4");
  });
});

describe("summarizeDelivery -- UX-21's own example phrase shape", () => {
  it("summarises a boundary delivery", () => {
    expect(summarizeDelivery(baseInput({ runs: 4, isBoundary: true }))).toBe("Over 12.4: Smith to Jones, 4 runs, boundary");
  });

  it("summarises a dot ball", () => {
    expect(summarizeDelivery(baseInput({ runs: 0 }))).toBe("Over 12.4: Smith to Jones, dot ball");
  });

  it("summarises a single run without the boundary qualifier", () => {
    expect(summarizeDelivery(baseInput({ runs: 1 }))).toBe("Over 12.4: Smith to Jones, 1 run");
  });

  it("summarises a wicket, taking priority over runs", () => {
    expect(summarizeDelivery(baseInput({ wicketDescription: "bowled" }))).toBe("Over 12.4: Smith to Jones, bowled");
  });

  it("summarises an extra when no wicket is present", () => {
    expect(summarizeDelivery(baseInput({ extraDescription: "wide" }))).toBe("Over 12.4: Smith to Jones, wide");
  });

  it("a wicket takes priority over an extra description if both are somehow present", () => {
    expect(summarizeDelivery(baseInput({ wicketDescription: "run out", extraDescription: "wide" }))).toBe(
      "Over 12.4: Smith to Jones, run out",
    );
  });
});

describe("matchesFilter / hasActiveFilter", () => {
  const delivery: FilterableDelivery = { overNumber: 12, bowlerId: "b1", strikerId: "s1", phase: "MIDDLE" };

  it("matches everything with no active filter", () => {
    expect(matchesFilter(delivery, initialDeliveryFilter())).toBe(true);
    expect(hasActiveFilter(initialDeliveryFilter())).toBe(false);
  });

  it("filters by over range", () => {
    expect(matchesFilter(delivery, { ...initialDeliveryFilter(), overRange: [1, 10] })).toBe(false);
    expect(matchesFilter(delivery, { ...initialDeliveryFilter(), overRange: [10, 15] })).toBe(true);
  });

  it("filters by bowler", () => {
    expect(matchesFilter(delivery, { ...initialDeliveryFilter(), bowlerId: "b2" })).toBe(false);
    expect(matchesFilter(delivery, { ...initialDeliveryFilter(), bowlerId: "b1" })).toBe(true);
  });

  it("filters by batter", () => {
    expect(matchesFilter(delivery, { ...initialDeliveryFilter(), batterId: "s2" })).toBe(false);
  });

  it("filters by phase", () => {
    expect(matchesFilter(delivery, { ...initialDeliveryFilter(), phase: "POWERPLAY" })).toBe(false);
  });

  it("hasActiveFilter is true when any dimension is set", () => {
    expect(hasActiveFilter({ ...initialDeliveryFilter(), bowlerId: "b1" })).toBe(true);
  });
});

describe("parseOverBallQuery", () => {
  it("parses a valid over.ball query", () => {
    expect(parseOverBallQuery("12.4")).toEqual({ overNumber: 12, ballInOver: 4 });
  });

  it("trims surrounding whitespace", () => {
    expect(parseOverBallQuery("  3.2  ")).toEqual({ overNumber: 3, ballInOver: 2 });
  });

  it("rejects a malformed query", () => {
    expect(parseOverBallQuery("not a query")).toBeNull();
    expect(parseOverBallQuery("12")).toBeNull();
    expect(parseOverBallQuery("12.")).toBeNull();
  });
});

describe("shouldAutoScrollToNewest", () => {
  it("auto-scrolls when the user has not scrolled up", () => {
    expect(shouldAutoScrollToNewest(false)).toBe(true);
  });

  it("does not auto-scroll once the user has scrolled up", () => {
    expect(shouldAutoScrollToNewest(true)).toBe(false);
  });
});
