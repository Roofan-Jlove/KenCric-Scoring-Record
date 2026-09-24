import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BallEntryScreen } from "./BallEntryScreen";

const baseProps = {
  isFreeHit: false,
  isGuardrailModalOpen: false,
  justRecorded: false,
  undoAvailable: false,
  overthrowConfirmThreshold: 4,
  onSubmit: vi.fn(),
  onUndo: vi.fn(),
};

describe("BallEntryScreen (UX-11)", () => {
  it("a single tap on a run value commits immediately with no confirmation", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BallEntryScreen {...baseProps} onSubmit={onSubmit} />);

    await user.click(within(screen.getByRole("group", { name: "Run value" })).getByRole("button", { name: "4" }));

    expect(onSubmit).toHaveBeenCalledWith(4, null);
  });

  it("an optional commentary note is passed through but never blocks submission", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BallEntryScreen {...baseProps} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Commentary note (optional)"), "Streaky edge");
    await user.click(within(screen.getByRole("group", { name: "Run value" })).getByRole("button", { name: "1" }));

    expect(onSubmit).toHaveBeenCalledWith(1, "Streaky edge");
  });

  it("composing an overthrow below the confirm threshold submits directly", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BallEntryScreen {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Add overthrow" }));
    const overthrowGroup = screen.getByRole("group", { name: "Overthrow entry" });
    await user.selectOptions(within(overthrowGroup).getByLabelText("Run value"), "1");
    await user.clear(within(overthrowGroup).getByLabelText("Overthrow runs"));
    await user.type(within(overthrowGroup).getByLabelText("Overthrow runs"), "2");
    await user.click(within(overthrowGroup).getByRole("button", { name: "Confirm overthrow" }));

    expect(onSubmit).toHaveBeenCalledWith(3, null);
  });

  it("a large overthrow above the threshold requires an extra confirm step before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BallEntryScreen {...baseProps} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Add overthrow" }));
    const overthrowGroup = screen.getByRole("group", { name: "Overthrow entry" });
    await user.selectOptions(within(overthrowGroup).getByLabelText("Run value"), "1");
    await user.clear(within(overthrowGroup).getByLabelText("Overthrow runs"));
    await user.type(within(overthrowGroup).getByLabelText("Overthrow runs"), "5");
    await user.click(within(overthrowGroup).getByRole("button", { name: "Confirm overthrow" }));

    expect(onSubmit).not.toHaveBeenCalled();
    const confirmDialog = screen.getByRole("alertdialog", { name: "Confirm large overthrow" });
    await user.click(within(confirmDialog).getByRole("button", { name: "Confirm" }));
    expect(onSubmit).toHaveBeenCalledWith(6, null);
  });

  it("the free-hit badge is shown when isFreeHit is true", () => {
    render(<BallEntryScreen {...baseProps} isFreeHit={true} />);
    expect(screen.getByRole("status", { name: "Free hit" })).toBeInTheDocument();
  });

  it("run-value buttons are disabled while a guardrail modal is open", () => {
    render(<BallEntryScreen {...baseProps} isGuardrailModalOpen={true} />);
    expect(within(screen.getByRole("group", { name: "Run value" })).getByRole("button", { name: "4" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("guardrail");
  });

  it("Undo is enabled only when undoAvailable is true", () => {
    const { rerender } = render(<BallEntryScreen {...baseProps} />);
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    rerender(<BallEntryScreen {...baseProps} undoAvailable={true} />);
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled();
  });

  it("clicking Undo calls onUndo", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<BallEntryScreen {...baseProps} undoAvailable={true} onUndo={onUndo} />);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
