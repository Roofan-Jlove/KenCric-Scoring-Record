import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FenceConflictScreen } from "./FenceConflictScreen";

const baseProps = {
  otherDeviceId: "device-42",
  conflictDetectedAt: "2026-09-28 10:00",
  onResolved: vi.fn(),
};

describe("FenceConflictScreen (UX-25, fence-conflict half)", () => {
  it("shows the 'another device is scoring this match' notice with device and time information", () => {
    render(<FenceConflictScreen {...baseProps} />);
    expect(screen.getByRole("alert")).toHaveTextContent("device-42");
    expect(screen.getByRole("alert")).toHaveTextContent("2026-09-28 10:00");
  });

  it("Cancel resolves immediately with DISCARD_LOCALLY, no acknowledgement required", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(<FenceConflictScreen {...baseProps} onResolved={onResolved} />);
    await user.click(screen.getByRole("button", { name: "Cancel and keep the original device active" }));
    expect(onResolved).toHaveBeenCalledWith("DISCARD_LOCALLY");
  });

  it("Take Over requires explicit acknowledgement before it succeeds", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(<FenceConflictScreen {...baseProps} onResolved={onResolved} />);
    await user.click(screen.getByRole("button", { name: "Take over scoring on this device" }));
    await user.click(screen.getByRole("button", { name: "Confirm take over" }));

    expect(onResolved).not.toHaveBeenCalled();
    expect(screen.getByText(/must acknowledge/)).toBeInTheDocument();
  });

  it("Take Over succeeds once the lockout checkbox is checked", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(<FenceConflictScreen {...baseProps} onResolved={onResolved} />);
    await user.click(screen.getByRole("button", { name: "Take over scoring on this device" }));
    await user.click(screen.getByRole("checkbox", { name: /locked out/ }));
    await user.click(screen.getByRole("button", { name: "Confirm take over" }));

    expect(onResolved).toHaveBeenCalledWith("TAKE_OVER");
  });

  it("Back returns to the initial choice without resolving anything", async () => {
    const user = userEvent.setup();
    const onResolved = vi.fn();
    render(<FenceConflictScreen {...baseProps} onResolved={onResolved} />);
    await user.click(screen.getByRole("button", { name: "Take over scoring on this device" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("button", { name: "Take over scoring on this device" })).toBeInTheDocument();
    expect(onResolved).not.toHaveBeenCalled();
  });
});
