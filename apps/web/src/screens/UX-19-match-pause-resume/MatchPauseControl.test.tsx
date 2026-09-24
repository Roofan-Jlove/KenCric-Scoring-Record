import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MatchPauseControl } from "./MatchPauseControl";

describe("MatchPauseControl (UX-19)", () => {
  it("shows a Pause control initially", () => {
    render(<MatchPauseControl onPaused={vi.fn()} onResumed={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("clicking Pause opens the reason picker", async () => {
    const user = userEvent.setup();
    render(<MatchPauseControl onPaused={vi.fn()} onResumed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("group", { name: "Reason for pause" })).toBeInTheDocument();
  });

  it("confirming pause without selecting a reason is blocked", async () => {
    const user = userEvent.setup();
    const onPaused = vi.fn();
    render(<MatchPauseControl onPaused={onPaused} onResumed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("button", { name: "Confirm pause" }));

    expect(onPaused).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("A reason is required to pause");
  });

  it("selecting a preset reason and confirming shows the unmistakable paused banner", async () => {
    const user = userEvent.setup();
    const onPaused = vi.fn();
    render(<MatchPauseControl onPaused={onPaused} onResumed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("radio", { name: "Rain" }));
    await user.click(screen.getByRole("button", { name: "Confirm pause" }));

    expect(onPaused).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Match paused: Rain");
  });

  it("Resume is the first focusable element when paused", async () => {
    const user = userEvent.setup();
    render(<MatchPauseControl onPaused={vi.fn()} onResumed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("radio", { name: "Drinks" }));
    await user.click(screen.getByRole("button", { name: "Confirm pause" }));

    expect(screen.getByRole("button", { name: "Resume" })).toHaveFocus();
  });

  it("clicking Resume returns to the Pause control and reports the record", async () => {
    const user = userEvent.setup();
    const onResumed = vi.fn();
    render(<MatchPauseControl onPaused={vi.fn()} onResumed={onResumed} />);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("radio", { name: "Injury" }));
    await user.click(screen.getByRole("button", { name: "Confirm pause" }));
    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(onResumed).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("selecting Other requires free text before confirming", async () => {
    const user = userEvent.setup();
    const onPaused = vi.fn();
    render(<MatchPauseControl onPaused={onPaused} onResumed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    await user.click(screen.getByRole("radio", { name: "Other" }));
    await user.click(screen.getByRole("button", { name: "Confirm pause" }));

    expect(onPaused).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Other reason"), "Power outage");
    await user.click(screen.getByRole("button", { name: "Confirm pause" }));
    expect(onPaused).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Match paused: Power outage");
  });
});
