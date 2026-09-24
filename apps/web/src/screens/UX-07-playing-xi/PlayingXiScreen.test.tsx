import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayingXiScreen } from "./PlayingXiScreen";
import type { Player } from "./playingXiForm";

function squadOf(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player ${i}`, isAdHoc: false }));
}

describe("PlayingXiScreen (UX-07)", () => {
  it("Continue starts aria-disabled -- no players selected on either side", () => {
    render(<PlayingXiScreen squadA={squadOf(2)} squadB={squadOf(2)} requiredXiSize={1} onContinue={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("aria-disabled", "true");
  });

  it("checkboxes carry the player's name as their accessible label", () => {
    render(<PlayingXiScreen squadA={squadOf(1)} squadB={squadOf(1)} requiredXiSize={1} onContinue={vi.fn()} />);
    expect(screen.getAllByRole("checkbox", { name: "Player 0" })[0]).toBeInTheDocument();
  });

  it("toggling past the required XI size is blocked with an alert naming the reason", async () => {
    const user = userEvent.setup();
    render(<PlayingXiScreen squadA={squadOf(2)} squadB={squadOf(1)} requiredXiSize={1} onContinue={vi.fn()} />);
    const sideA = screen.getByRole("region", { name: "Team A XI" });
    const checkboxes = within(sideA).getAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    expect(screen.getByRole("alert")).toHaveTextContent("XI is full — remove someone first");
  });

  it("selecting a full XI with a captain and keeper on both sides, with no overlap, enables Continue", async () => {
    const user = userEvent.setup();
    const squadA = squadOf(1);
    const squadB = [{ id: "q0", name: "Q0", isAdHoc: false }];
    render(<PlayingXiScreen squadA={squadA} squadB={squadB} requiredXiSize={1} onContinue={vi.fn()} />);

    const sideA = screen.getByRole("region", { name: "Team A XI" });
    const sideB = screen.getByRole("region", { name: "Team B XI" });
    await user.click(within(sideA).getByRole("checkbox", { name: "Player 0" }));
    await user.click(within(sideB).getByRole("checkbox", { name: "Q0" }));

    const radiosA = within(sideA).getAllByRole("radio");
    await user.click(radiosA[0]); // captain
    await user.click(radiosA[1]); // keeper
    const radiosB = within(sideB).getAllByRole("radio");
    await user.click(radiosB[0]);
    await user.click(radiosB[1]);

    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("aria-disabled", "false");
  });

  it("a Continue attempt with no keeper marked shows an inline error naming it", async () => {
    const user = userEvent.setup();
    render(<PlayingXiScreen squadA={squadOf(1)} squadB={squadOf(1)} requiredXiSize={1} onContinue={vi.fn()} />);
    const sideA = screen.getByRole("region", { name: "Team A XI" });
    await user.click(within(sideA).getByRole("checkbox", { name: "Player 0" }));
    await user.click(within(sideA).getAllByRole("radio")[0]); // captain only

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(within(sideA).getByRole("alert")).toHaveTextContent("wicket-keeper required");
  });

  it("onContinue is not called when the state is invalid", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<PlayingXiScreen squadA={squadOf(1)} squadB={squadOf(1)} requiredXiSize={1} onContinue={onContinue} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).not.toHaveBeenCalled();
  });
});
