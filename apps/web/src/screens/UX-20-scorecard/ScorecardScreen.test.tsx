import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScorecardScreen } from "./ScorecardScreen";
import type { BattingOrderEntry } from "./ScorecardScreen";

const battingOrder: BattingOrderEntry[] = [
  {
    playerId: "p1",
    playerName: "Alice",
    line: { playerId: "p1", runs: 50, ballsFaced: 40, fours: 4, sixes: 1, status: "NOT_OUT" },
  },
  {
    playerId: "p2",
    playerName: "Bea",
    // a genuine duck -- B-J1
    line: { playerId: "p2", runs: 0, ballsFaced: 0, fours: 0, sixes: 0, status: "OUT" },
  },
  {
    playerId: "p3",
    playerName: "Cara",
    line: null, // never came in
  },
];

const bowlingLines = [
  { playerId: "b1", playerName: "Dora", legalBallsBowled: 20, runsCharged: 18, wickets: 1, widesBowled: 1, noBallsBowled: 0, maidens: 0 },
];

const inningsState = { totalRuns: 50, byes: 0, legByes: 0, wides: 0, noBalls: 0, penalty: 0, wicketsLost: 1, legalBallsBowled: 40 };

const baseProps = {
  battingOrder,
  bowlingLines,
  inningsState,
  ballsPerOver: 6,
  partnerships: [],
  fallOfWickets: [],
  result: "Team A won by 5 wickets",
  reconciliationStatus: "RECONCILED" as const,
  isFinal: false,
};

describe("ScorecardScreen (UX-20)", () => {
  it("shows a genuine duck (0 off 0) as a real batting row, distinct from never batted", () => {
    render(<ScorecardScreen {...baseProps} />);
    const battingTable = screen.getByRole("table", { name: "Batting card" });
    expect(within(battingTable).getByRole("rowheader", { name: "Bea" })).toBeInTheDocument();
    expect(within(battingTable).queryByRole("rowheader", { name: "Cara" })).not.toBeInTheDocument();
  });

  it("lists a batter who never came in under Did not bat", () => {
    render(<ScorecardScreen {...baseProps} />);
    expect(screen.getByLabelText("Did not bat")).toHaveTextContent("Cara");
  });

  it("does not show a Did not bat line when everyone has batted", () => {
    render(<ScorecardScreen {...baseProps} battingOrder={battingOrder.slice(0, 2)} />);
    expect(screen.queryByLabelText("Did not bat")).not.toBeInTheDocument();
  });

  it("marks a not-out batter with an asterisk", () => {
    render(<ScorecardScreen {...baseProps} />);
    expect(screen.getByRole("rowheader", { name: "Alice*" })).toBeInTheDocument();
  });

  it("renders the extras and total lines per SCRD-007/008", () => {
    render(<ScorecardScreen {...baseProps} />);
    expect(screen.getByText("Extras (b 0, lb 0, w 0, nb 0, pen 0) = 0")).toBeInTheDocument();
    expect(screen.getByText(/^Total \(1 wkts, 6\.4 overs\)/)).toBeInTheDocument();
  });

  it("shows real table semantics with row/column headers for the bowling card", () => {
    render(<ScorecardScreen {...baseProps} />);
    const bowlingTable = screen.getByRole("table", { name: "Bowling card" });
    expect(within(bowlingTable).getByRole("columnheader", { name: "Econ" })).toBeInTheDocument();
    expect(within(bowlingTable).getByRole("rowheader", { name: "Dora" })).toBeInTheDocument();
  });

  it("shows provisional-vs-final as a text label, not color alone", () => {
    render(<ScorecardScreen {...baseProps} isFinal={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Provisional");
  });

  it("shows Official when isFinal is true", () => {
    render(<ScorecardScreen {...baseProps} isFinal={true} />);
    expect(screen.getByRole("status")).toHaveTextContent("Official");
  });

  it("shows the reconciliation status badge", () => {
    render(<ScorecardScreen {...baseProps} reconciliationStatus="OVERRIDE_NOTED" />);
    expect(screen.getByLabelText("Reconciliation status")).toHaveTextContent("Override-noted");
  });

  it("shows the result statement", () => {
    render(<ScorecardScreen {...baseProps} />);
    expect(screen.getByLabelText("Result")).toHaveTextContent("Team A won by 5 wickets");
  });
});
