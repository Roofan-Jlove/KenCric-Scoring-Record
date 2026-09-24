import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StrikeChangeScreen } from "./StrikeChangeScreen";

const striker = { id: "b1", name: "Alice" };
const nonStriker = { id: "b2", name: "Bea" };

describe("StrikeChangeScreen (UX-14)", () => {
  it("shows the current striker marked with icon and text", () => {
    render(<StrikeChangeScreen striker={striker} nonStriker={nonStriker} readOnly={false} onOverrideConfirmed={vi.fn()} />);
    expect(screen.getByLabelText("Striker")).toHaveTextContent("On strike: Alice");
    expect(screen.getByLabelText("Non-striker")).toHaveTextContent("Non-striker: Bea");
  });

  it("the swap-ends control's accessible name states its effect explicitly", () => {
    render(<StrikeChangeScreen striker={striker} nonStriker={nonStriker} readOnly={false} onOverrideConfirmed={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Swap striker and non-striker" })).toBeInTheDocument();
  });

  it("tapping Swap ends opens the reason field, without applying anything yet", async () => {
    const user = userEvent.setup();
    const onOverrideConfirmed = vi.fn();
    render(
      <StrikeChangeScreen striker={striker} nonStriker={nonStriker} readOnly={false} onOverrideConfirmed={onOverrideConfirmed} />,
    );
    await user.click(screen.getByRole("button", { name: "Swap striker and non-striker" }));
    expect(screen.getByLabelText("Reason for override")).toBeInTheDocument();
    expect(onOverrideConfirmed).not.toHaveBeenCalled();
  });

  it("leaving the reason blank blocks confirmation with an inline error", async () => {
    const user = userEvent.setup();
    render(<StrikeChangeScreen striker={striker} nonStriker={nonStriker} readOnly={false} onOverrideConfirmed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Swap striker and non-striker" }));
    await user.click(screen.getByRole("button", { name: "Confirm override" }));
    expect(screen.getByRole("alert")).toHaveTextContent("reason");
  });

  it("confirming with a reason swaps the display and calls onOverrideConfirmed", async () => {
    const user = userEvent.setup();
    const onOverrideConfirmed = vi.fn();
    render(
      <StrikeChangeScreen striker={striker} nonStriker={nonStriker} readOnly={false} onOverrideConfirmed={onOverrideConfirmed} />,
    );
    await user.click(screen.getByRole("button", { name: "Swap striker and non-striker" }));
    await user.type(screen.getByLabelText("Reason for override"), "Running mix-up correction");
    await user.click(screen.getByRole("button", { name: "Confirm override" }));

    expect(screen.getByLabelText("Striker")).toHaveTextContent("On strike: Bea");
    expect(screen.getByRole("status")).toHaveTextContent("Manually set");
    expect(onOverrideConfirmed).toHaveBeenCalledWith({ strikerId: "b2", nonStrikerId: "b1" }, "Running mix-up correction");
  });

  it("Cancel returns to the auto state without applying anything", async () => {
    const user = userEvent.setup();
    render(<StrikeChangeScreen striker={striker} nonStriker={nonStriker} readOnly={false} onOverrideConfirmed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Swap striker and non-striker" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Striker")).toHaveTextContent("On strike: Alice");
    expect(screen.queryByLabelText("Reason for override")).not.toBeInTheDocument();
  });

  it("Swap ends is disabled while read-only (over-transition animation)", () => {
    render(<StrikeChangeScreen striker={striker} nonStriker={nonStriker} readOnly={true} onOverrideConfirmed={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Swap striker and non-striker" })).toBeDisabled();
  });
});
