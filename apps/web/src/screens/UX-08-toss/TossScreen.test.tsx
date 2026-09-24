import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TossScreen } from "./TossScreen";

describe("TossScreen (UX-08)", () => {
  it("Confirm starts disabled -- neither field selected", () => {
    render(
      <TossScreen teamAName="Riverside CC" teamBName="Harbour CC" isLocked={false} onConfirm={vi.fn()} onAmend={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });

  it("confirming derives and reports the innings order -- N-B2", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <TossScreen teamAName="Riverside CC" teamBName="Harbour CC" isLocked={false} onConfirm={onConfirm} onAmend={vi.fn()} />,
    );

    await user.click(screen.getByRole("radio", { name: "Riverside CC" }));
    await user.click(screen.getByRole("radio", { name: "Bat" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ winner: "A", decision: "BAT", confirmed: true }),
      { battingFirst: "A", chasingSide: "B" },
    );
  });

  it("a locked toss shows the locked explanation, not a flat refusal", () => {
    render(
      <TossScreen teamAName="Riverside CC" teamBName="Harbour CC" isLocked={true} onConfirm={vi.fn()} onAmend={vi.fn()} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("locked");
    expect(screen.getByRole("button", { name: "Request an amendment" })).toBeInTheDocument();
  });

  it("submitting an amendment with a blank reason is rejected", async () => {
    const user = userEvent.setup();
    render(
      <TossScreen teamAName="Riverside CC" teamBName="Harbour CC" isLocked={true} onConfirm={vi.fn()} onAmend={vi.fn()} />,
    );
    await user.click(screen.getByRole("button", { name: "Request an amendment" }));
    await user.click(screen.getByRole("radio", { name: "Harbour CC" }));
    await user.click(screen.getByRole("radio", { name: "Bowl" }));
    await user.click(screen.getByRole("button", { name: "Submit amendment" }));

    expect(screen.getByRole("alert")).toHaveTextContent("reason");
  });

  it("submitting an amendment with a reason calls onAmend with the new state", async () => {
    const user = userEvent.setup();
    const onAmend = vi.fn();
    render(
      <TossScreen teamAName="Riverside CC" teamBName="Harbour CC" isLocked={true} onConfirm={vi.fn()} onAmend={onAmend} />,
    );
    await user.click(screen.getByRole("button", { name: "Request an amendment" }));
    await user.click(screen.getByRole("radio", { name: "Harbour CC" }));
    await user.click(screen.getByRole("radio", { name: "Bowl" }));
    await user.type(screen.getByLabelText("Reason for amendment"), "Recorded incorrectly");
    await user.click(screen.getByRole("button", { name: "Submit amendment" }));

    expect(onAmend).toHaveBeenCalledWith(
      expect.objectContaining({ winner: "B", decision: "BOWL", confirmed: true }),
      "Recorded incorrectly",
    );
  });
});
