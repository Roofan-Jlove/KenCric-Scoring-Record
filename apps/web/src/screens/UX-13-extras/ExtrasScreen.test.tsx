import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExtrasScreen } from "./ExtrasScreen";

const allEnabled = new Set(["WIDE", "NO_BALL", "BYE", "LEG_BYE", "PENALTY"] as const);

describe("ExtrasScreen (UX-13)", () => {
  it("selecting an enabled type and confirming submits it", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ExtrasScreen enabledTypes={allEnabled} onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(within(screen.getByRole("group", { name: "Extra type" })).getByRole("button", { name: "Wide" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ type: "WIDE", additionalRuns: 0 }));
  });

  it("a disabled type stays visible but tapping it shows the reason instead of selecting it", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ExtrasScreen
        enabledTypes={new Set(["WIDE", "BYE", "LEG_BYE"])}
        disabledReasons={{ PENALTY: "Not used in this format" }}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    const modeGroup = screen.getByRole("group", { name: "Extra type" });
    expect(within(modeGroup).getByRole("button", { name: "Penalty" })).toBeInTheDocument();
    await user.click(within(modeGroup).getByRole("button", { name: "Penalty" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Not used in this format");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("adjusting the additional-runs stepper announces the current value", async () => {
    const user = userEvent.setup();
    render(<ExtrasScreen enabledTypes={allEnabled} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    await user.click(within(screen.getByRole("group", { name: "Extra type" })).getByRole("button", { name: "Wide" }));

    const input = screen.getByLabelText("Additional runs");
    await user.clear(input);
    await user.type(input, "3");

    expect(screen.getByText("Additional runs: 3")).toBeInTheDocument();
  });

  it("confirming a penalty with a blank reason is blocked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ExtrasScreen enabledTypes={allEnabled} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(within(screen.getByRole("group", { name: "Extra type" })).getByRole("button", { name: "Penalty" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("reason");
  });

  it("a fully completed penalty confirms with reason and recipient side", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ExtrasScreen enabledTypes={allEnabled} onConfirm={onConfirm} onCancel={vi.fn()} />);
    await user.click(within(screen.getByRole("group", { name: "Extra type" })).getByRole("button", { name: "Penalty" }));
    await user.type(screen.getByLabelText("Penalty reason"), "Deliberate obstruction");
    await user.click(screen.getByRole("radio", { name: "Batting side" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ type: "PENALTY", penaltyReason: "Deliberate obstruction", penaltyRecipientSide: "BATTING" }),
    );
  });

  it("Cancel calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ExtrasScreen enabledTypes={allEnabled} onConfirm={vi.fn()} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
