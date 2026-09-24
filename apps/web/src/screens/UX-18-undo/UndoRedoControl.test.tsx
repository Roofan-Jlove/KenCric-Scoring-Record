import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UndoRedoControl } from "./UndoRedoControl";

const baseProps = {
  hasRecentAction: true,
  isGuardrailModalOpen: false,
  canFullyReverse: true,
  mostRecentActionLabel: "4 runs, over 3.2",
  onUndoApplied: vi.fn(),
  onRedoApplied: vi.fn(),
  onRouteToCorrection: vi.fn(),
};

describe("UndoRedoControl (UX-18)", () => {
  it("has a persistent, unambiguous accessible name", () => {
    render(<UndoRedoControl {...baseProps} />);
    expect(screen.getByRole("button", { name: "Undo: revert last ball" })).toBeInTheDocument();
  });

  it("Undo is disabled with no recent action, shown with an accessible explanation, not hidden", () => {
    render(<UndoRedoControl {...baseProps} hasRecentAction={false} />);
    const button = screen.getByRole("button", { name: "Undo: revert last ball" });
    expect(button).toBeDisabled();
    expect(button).toBeInTheDocument();
    expect(screen.getByText("Nothing to undo")).toBeInTheDocument();
  });

  it("Undo is disabled while a guardrail modal is open", () => {
    render(<UndoRedoControl {...baseProps} isGuardrailModalOpen={true} />);
    expect(screen.getByRole("button", { name: "Undo: revert last ball" })).toBeDisabled();
    expect(screen.getByText("Disabled while a guardrail modal is open")).toBeInTheDocument();
  });

  it("Redo starts disabled before any Undo", () => {
    render(<UndoRedoControl {...baseProps} />);
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("clicking Undo enables Redo and announces what was undone", async () => {
    const user = userEvent.setup();
    const onUndoApplied = vi.fn();
    render(<UndoRedoControl {...baseProps} onUndoApplied={onUndoApplied} />);
    await user.click(screen.getByRole("button", { name: "Undo: revert last ball" }));

    expect(onUndoApplied).toHaveBeenCalledWith("4 runs, over 3.2");
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
    expect(screen.getByText("Undone: 4 runs, over 3.2")).toBeInTheDocument();
  });

  it("clicking Redo after an Undo restores the action and announces it", async () => {
    const user = userEvent.setup();
    const onRedoApplied = vi.fn();
    render(<UndoRedoControl {...baseProps} onRedoApplied={onRedoApplied} />);
    await user.click(screen.getByRole("button", { name: "Undo: revert last ball" }));
    await user.click(screen.getByRole("button", { name: "Redo" }));

    expect(onRedoApplied).toHaveBeenCalledWith("4 runs, over 3.2");
    expect(screen.getByText("Redone: 4 runs, over 3.2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
  });

  it("routes to Score Correction instead of undoing when the action can't be fully reversed", async () => {
    const user = userEvent.setup();
    const onUndoApplied = vi.fn();
    const onRouteToCorrection = vi.fn();
    render(<UndoRedoControl {...baseProps} canFullyReverse={false} onUndoApplied={onUndoApplied} onRouteToCorrection={onRouteToCorrection} />);
    await user.click(screen.getByRole("button", { name: "Undo: revert last ball" }));

    expect(onUndoApplied).not.toHaveBeenCalled();
    expect(onRouteToCorrection).toHaveBeenCalledWith(expect.stringContaining("Score Correction"));
  });
});
