import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MatchHistoryScreen } from "./MatchHistoryScreen";
import type { MatchSummary } from "./matchHistoryForm";

const matches: MatchSummary[] = [
  { id: "m1", teamAName: "Riverside CC", teamBName: "Harbour CC", competition: "Summer League", venue: "Riverside Ground", date: "2026-06-01", state: "FINAL" },
  { id: "m2", teamAName: "Oakwood CC", teamBName: "Elmwood CC", competition: "Cup", venue: "Oakwood Park", date: "2026-07-15", state: "IN_PROGRESS" },
];

const baseProps = {
  matches,
  isLoading: false,
  isOffline: false,
  onOpenMatch: vi.fn(),
  onCreateMatch: vi.fn(),
};

describe("MatchHistoryScreen (UX-26)", () => {
  it("shows a loading state", () => {
    render(<MatchHistoryScreen {...baseProps} isLoading={true} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });

  it("shows the create-match call to action when there is genuinely no history yet", () => {
    render(<MatchHistoryScreen {...baseProps} matches={[]} />);
    expect(screen.getByText(/completed matches will appear/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Match" })).toBeInTheDocument();
  });

  it("announces a live result count", () => {
    render(<MatchHistoryScreen {...baseProps} />);
    expect(screen.getByText("2 matches found")).toBeInTheDocument();
  });

  it("searching narrows the visible list", async () => {
    const user = userEvent.setup();
    render(<MatchHistoryScreen {...baseProps} />);
    await user.type(screen.getByLabelText("Search matches"), "riverside");

    expect(screen.getByText("1 matches found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Riverside CC vs Harbour CC/ })).toBeInTheDocument();
  });

  it("shows a distinct filtered-empty message when matches exist but none match the current filters", async () => {
    const user = userEvent.setup();
    render(<MatchHistoryScreen {...baseProps} />);
    await user.type(screen.getByLabelText("Search matches"), "nonexistent team");

    expect(screen.getByText("No matches for the current filters")).toBeInTheDocument();
  });

  it("filter chips expose a pressed/unpressed state", async () => {
    const user = userEvent.setup();
    render(<MatchHistoryScreen {...baseProps} />);
    const chip = screen.getByRole("button", { name: "Final" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("Clear filters restores the full list, and only ever appears once", async () => {
    const user = userEvent.setup();
    render(<MatchHistoryScreen {...baseProps} />);
    await user.type(screen.getByLabelText("Search matches"), "nonexistent team");

    expect(screen.getAllByRole("button", { name: "Clear filters" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("2 matches found")).toBeInTheDocument();
  });

  it("clicking a match calls onOpenMatch with its id and state", async () => {
    const user = userEvent.setup();
    const onOpenMatch = vi.fn();
    render(<MatchHistoryScreen {...baseProps} onOpenMatch={onOpenMatch} />);
    await user.click(screen.getByRole("button", { name: /Riverside CC vs Harbour CC/ }));
    expect(onOpenMatch).toHaveBeenCalledWith("m1", "FINAL");
  });

  it("shows an offline note that results may be incomplete", () => {
    render(<MatchHistoryScreen {...baseProps} isOffline={true} />);
    expect(screen.getByText(/results may be incomplete/)).toBeInTheDocument();
  });
});
