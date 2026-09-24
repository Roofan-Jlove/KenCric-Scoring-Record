import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WicketEntryScreen } from "./WicketEntryScreen";

const battingXiNotOut = [
  { id: "striker-1", name: "Alice" },
  { id: "b2", name: "Bea" },
  { id: "b3", name: "Cara" },
];
const fieldingXi = [{ id: "f1", name: "Dora" }];

const baseProps = {
  legality: "LEGAL" as const,
  isFreeHit: false,
  strikerId: "striker-1",
  battingXiNotOut,
  fieldingXi,
  endsInnings: false,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe("WicketEntryScreen (UX-12)", () => {
  it("a mode invalid for the current context is not rendered at all", () => {
    render(<WicketEntryScreen {...baseProps} legality="NO_BALL" />);
    const modeGroup = screen.getByRole("group", { name: "Dismissal mode" });
    expect(within(modeGroup).queryByRole("button", { name: "Stumped" })).not.toBeInTheDocument();
    expect(within(modeGroup).getByRole("button", { name: "Run Out" })).toBeInTheDocument();
  });

  it("the one-line reason for an unavailable mode is available on request, not shown by default", async () => {
    const user = userEvent.setup();
    render(<WicketEntryScreen {...baseProps} legality="NO_BALL" />);
    expect(screen.queryAllByText(/no-ball/)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Why are other modes unavailable?" }));
    expect(screen.getAllByText(/no-ball/).length).toBeGreaterThan(0);
  });

  it("selecting Caught reveals a required fielder field", async () => {
    const user = userEvent.setup();
    render(<WicketEntryScreen {...baseProps} />);
    await user.click(within(screen.getByRole("group", { name: "Dismissal mode" })).getByRole("button", { name: "Caught" }));
    expect(screen.getByLabelText("Fielder")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fielder")).toBeInTheDocument();
  });

  it("confirming Caught without a fielder blocks with an inline error", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<WicketEntryScreen {...baseProps} onConfirm={onConfirm} />);
    await user.click(within(screen.getByRole("group", { name: "Dismissal mode" })).getByRole("button", { name: "Caught" }));
    await user.click(screen.getByRole("button", { name: "Confirm dismissal" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("Select the fielder")).toBeInTheDocument();
  });

  it("a fully completed Bowled dismissal confirms successfully", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<WicketEntryScreen {...baseProps} onConfirm={onConfirm} />);
    await user.click(within(screen.getByRole("group", { name: "Dismissal mode" })).getByRole("button", { name: "Bowled" }));
    await user.selectOptions(screen.getByLabelText("Incoming batter"), "b2");
    await user.click(screen.getByRole("button", { name: "Confirm dismissal" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "BOWLED", outBatterId: "striker-1", endVacated: "STRIKER", incomingBatterId: "b2" }),
    );
  });

  it("no incoming-batter picker is shown when the dismissal ends the innings", async () => {
    const user = userEvent.setup();
    render(<WicketEntryScreen {...baseProps} endsInnings={true} />);
    await user.click(within(screen.getByRole("group", { name: "Dismissal mode" })).getByRole("button", { name: "Bowled" }));
    expect(screen.queryByLabelText("Incoming batter")).not.toBeInTheDocument();
  });

  it("Cancel calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<WicketEntryScreen {...baseProps} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
