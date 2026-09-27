import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BallByBallScreen } from "./BallByBallScreen";
import type { Delivery } from "./BallByBallScreen";

const deliveries: Delivery[] = [
  {
    id: "d1",
    overNumber: 1,
    ballInOver: 1,
    bowlerName: "Smith",
    strikerName: "Jones",
    runs: 4,
    isBoundary: true,
    wicketDescription: null,
    extraDescription: null,
    bowlerId: "b1",
    strikerId: "s1",
    phase: "POWERPLAY",
  },
  {
    id: "d2",
    overNumber: 12,
    ballInOver: 4,
    bowlerName: "Dora",
    strikerName: "Alice",
    runs: 0,
    isBoundary: false,
    wicketDescription: "bowled",
    extraDescription: null,
    bowlerId: "b2",
    strikerId: "s2",
    phase: "MIDDLE",
  },
];

const baseProps = {
  deliveries,
  bowlerOptions: [{ id: "b1", name: "Smith" }, { id: "b2", name: "Dora" }],
  batterOptions: [{ id: "s1", name: "Jones" }, { id: "s2", name: "Alice" }],
  hasUserScrolledUp: false,
  onSelectDelivery: vi.fn(),
  onJumpToDelivery: vi.fn(),
};

describe("BallByBallScreen (UX-21)", () => {
  it("each row's accessible name summarises the whole delivery in one phrase", () => {
    render(<BallByBallScreen {...baseProps} />);
    expect(screen.getByRole("button", { name: "Over 1.1: Smith to Jones, 4 runs, boundary" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Over 12.4: Dora to Alice, bowled" })).toBeInTheDocument();
  });

  it("tapping a delivery calls onSelectDelivery", async () => {
    const user = userEvent.setup();
    const onSelectDelivery = vi.fn();
    render(<BallByBallScreen {...baseProps} onSelectDelivery={onSelectDelivery} />);
    await user.click(screen.getByRole("button", { name: "Over 1.1: Smith to Jones, 4 runs, boundary" }));
    expect(onSelectDelivery).toHaveBeenCalledWith("d1");
  });

  it("filtering by bowler narrows the visible list, with a Clear filters affordance", async () => {
    const user = userEvent.setup();
    render(<BallByBallScreen {...baseProps} />);
    await user.selectOptions(screen.getByLabelText("Bowler"), "b1");

    expect(screen.getByRole("button", { name: "Over 1.1: Smith to Jones, 4 runs, boundary" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Over 12.4: Dora to Alice, bowled" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("a filter matching nothing shows an explicit message and a clear-filters action", async () => {
    const user = userEvent.setup();
    render(<BallByBallScreen {...baseProps} />);
    await user.selectOptions(screen.getByLabelText("Bowler"), "b1");
    await user.selectOptions(screen.getByLabelText("Batter"), "s2");

    expect(screen.getByText("No deliveries match the current filters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("clicking Clear filters restores the full list", async () => {
    const user = userEvent.setup();
    render(<BallByBallScreen {...baseProps} />);
    await user.selectOptions(screen.getByLabelText("Bowler"), "b1");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("button", { name: "Over 12.4: Dora to Alice, bowled" })).toBeInTheDocument();
  });

  it("jumping to a valid over.ball calls onJumpToDelivery", async () => {
    const user = userEvent.setup();
    const onJumpToDelivery = vi.fn();
    render(<BallByBallScreen {...baseProps} onJumpToDelivery={onJumpToDelivery} />);
    await user.type(screen.getByLabelText("Jump to over.ball"), "12.4");
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(onJumpToDelivery).toHaveBeenCalledWith(12, 4);
  });

  it("jumping with a malformed query shows an inline error", async () => {
    const user = userEvent.setup();
    render(<BallByBallScreen {...baseProps} />);
    await user.type(screen.getByLabelText("Jump to over.ball"), "nonsense");
    await user.click(screen.getByRole("button", { name: "Go" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid over.ball");
  });

  it("shows a 'New ball' affordance instead of auto-scrolling when the user has scrolled up", () => {
    render(<BallByBallScreen {...baseProps} hasUserScrolledUp={true} />);
    expect(screen.getByRole("status")).toHaveTextContent("New ball ↓");
  });

  it("does not show the 'New ball' affordance while auto-scrolling", () => {
    render(<BallByBallScreen {...baseProps} hasUserScrolledUp={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
