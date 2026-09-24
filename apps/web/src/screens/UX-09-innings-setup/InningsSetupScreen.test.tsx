import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InningsSetupScreen } from "./InningsSetupScreen";
import type { Player } from "./inningsSetupForm";

const battingXi: Player[] = [
  { id: "b1", name: "Alice" },
  { id: "b2", name: "Bea" },
];
const fieldingXi: Player[] = [{ id: "f1", name: "Cara" }];

function renderScreen(onStart = vi.fn()) {
  render(
    <InningsSetupScreen
      battingSideName="Team A"
      fieldingSideName="Team B"
      battingXi={battingXi}
      fieldingXi={fieldingXi}
      onStart={onStart}
    />,
  );
  return {
    strikerGroup: screen.getByRole("group", { name: "Striker" }),
    nonStrikerGroup: screen.getByRole("group", { name: "Non-striker" }),
    bowlerGroup: screen.getByRole("group", { name: "Opening bowler" }),
  };
}

describe("InningsSetupScreen (UX-09)", () => {
  it("Confirm & Start starts disabled -- no roles selected", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: "Confirm & Start" })).toBeDisabled();
  });

  it("selecting distinct striker, non-striker, and bowler enables Confirm & Start", async () => {
    const user = userEvent.setup();
    const { strikerGroup, nonStrikerGroup, bowlerGroup } = renderScreen();

    await user.click(within(strikerGroup).getByRole("radio", { name: "Alice" }));
    await user.click(within(nonStrikerGroup).getByRole("radio", { name: "Bea" }));
    await user.click(within(bowlerGroup).getByRole("radio", { name: "Cara" }));

    expect(screen.getByRole("button", { name: "Confirm & Start" })).toBeEnabled();
  });

  it("selecting the same player for striker and non-striker is blocked inline", async () => {
    const user = userEvent.setup();
    const { strikerGroup, nonStrikerGroup } = renderScreen();

    await user.click(within(strikerGroup).getByRole("radio", { name: "Alice" }));
    await user.click(within(nonStrikerGroup).getByRole("radio", { name: "Alice" }));

    expect(screen.getByRole("alert")).toHaveTextContent("already selected");
  });

  it("the swap-ends control's accessible name states its effect explicitly", () => {
    renderScreen();
    expect(screen.getByRole("button", { name: "Swap striker and non-striker" })).toBeInTheDocument();
  });

  it("onStart is called with the final state when Confirm & Start is submitted", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    const { strikerGroup, nonStrikerGroup, bowlerGroup } = renderScreen(onStart);

    await user.click(within(strikerGroup).getByRole("radio", { name: "Alice" }));
    await user.click(within(nonStrikerGroup).getByRole("radio", { name: "Bea" }));
    await user.click(within(bowlerGroup).getByRole("radio", { name: "Cara" }));
    await user.click(screen.getByRole("button", { name: "Confirm & Start" }));

    expect(onStart).toHaveBeenCalledWith({ strikerId: "b1", nonStrikerId: "b2", bowlerId: "f1" });
  });
});
