import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TeamSelectionScreen } from "./TeamSelectionScreen";
import type { Team } from "./teamSelectionForm";

const teamA: Team = { id: "team-A", name: "Riverside CC", isAdHoc: false };
const teamB: Team = { id: "team-B", name: "Harbour CC", isAdHoc: false };

describe("TeamSelectionScreen (UX-06)", () => {
  it("Continue starts disabled -- no teams selected", () => {
    render(<TeamSelectionScreen availableTeams={[teamA, teamB]} requiredXiSize={2} onContinue={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("selecting the same team for both sides is blocked immediately with an alert", async () => {
    const user = userEvent.setup();
    render(<TeamSelectionScreen availableTeams={[teamA]} requiredXiSize={2} onContinue={vi.fn()} />);

    const sideA = screen.getByRole("region", { name: "Team A" });
    const sideB = screen.getByRole("region", { name: "Team B" });
    await user.click(within(sideA).getByRole("button", { name: "Riverside CC" }));
    await user.click(within(sideB).getByRole("button", { name: "Riverside CC" }));

    expect(screen.getByRole("alert")).toHaveTextContent("already selected");
  });

  it("adding players to both sides up to the required XI size enables Continue", async () => {
    const user = userEvent.setup();
    render(<TeamSelectionScreen availableTeams={[teamA, teamB]} requiredXiSize={2} onContinue={vi.fn()} />);

    const sideA = screen.getByRole("region", { name: "Team A" });
    const sideB = screen.getByRole("region", { name: "Team B" });
    await user.click(within(sideA).getByRole("button", { name: "Riverside CC" }));
    await user.click(within(sideB).getByRole("button", { name: "Harbour CC" }));

    for (const side of [sideA, sideB]) {
      await user.type(within(side).getByLabelText("Add player by name"), "Player One");
      await user.click(within(side).getByRole("button", { name: "Add" }));
      await user.type(within(side).getByLabelText("Add player by name"), "Player Two");
      await user.click(within(side).getByRole("button", { name: "Add" }));
    }

    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("remove-player controls carry the player's name in their accessible label", async () => {
    const user = userEvent.setup();
    render(<TeamSelectionScreen availableTeams={[teamA]} requiredXiSize={1} onContinue={vi.fn()} />);
    const sideA = screen.getByRole("region", { name: "Team A" });

    await user.click(within(sideA).getByRole("button", { name: "Riverside CC" }));
    await user.type(within(sideA).getByLabelText("Add player by name"), "J. Smith");
    await user.click(within(sideA).getByRole("button", { name: "Add" }));

    expect(within(sideA).getByRole("button", { name: "Remove J. Smith from squad" })).toBeInTheDocument();
  });

  it("swap sides exchanges the two teams", async () => {
    const user = userEvent.setup();
    render(<TeamSelectionScreen availableTeams={[teamA, teamB]} requiredXiSize={1} onContinue={vi.fn()} />);

    const sideA = screen.getByRole("region", { name: "Team A" });
    const sideB = screen.getByRole("region", { name: "Team B" });
    await user.click(within(sideA).getByRole("button", { name: "Riverside CC" }));
    await user.click(within(sideB).getByRole("button", { name: "Harbour CC" }));

    await user.click(screen.getByRole("button", { name: "Swap sides" }));

    expect(within(screen.getByRole("region", { name: "Team A" })).getByText("Selected: Harbour CC")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Team B" })).getByText("Selected: Riverside CC")).toBeInTheDocument();
  });

  it("the search results list announces its count", () => {
    render(<TeamSelectionScreen availableTeams={[teamA, teamB]} requiredXiSize={2} onContinue={vi.fn()} />);
    const listbox = screen.getAllByRole("listbox", { name: /2 found/ })[0];
    expect(listbox).toBeInTheDocument();
  });
});
