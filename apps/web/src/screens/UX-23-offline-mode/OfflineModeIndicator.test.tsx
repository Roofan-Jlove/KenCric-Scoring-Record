import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OfflineModeIndicator } from "./OfflineModeIndicator";

const baseProps = {
  isOnline: false,
  isBackendReachable: true,
  isSyncing: false,
  queuedCount: 3,
  lastSyncedTime: "2026-09-28 10:00",
  storageUsageLabel: "12 MB",
  onRetryConnection: vi.fn(),
  onJumpToSyncStatus: vi.fn(),
  onManageStorage: vi.fn(),
};

describe("OfflineModeIndicator (UX-23)", () => {
  it("shows the offline-with-queue message and icon label together, never color-only", () => {
    render(<OfflineModeIndicator {...baseProps} />);
    expect(screen.getByText("You're offline — carry on, we'll sync later")).toBeInTheDocument();
    expect(screen.getByText("cloud-off")).toBeInTheDocument();
  });

  it("shows distinct backend-degraded copy when online but the backend is unreachable", () => {
    render(<OfflineModeIndicator {...baseProps} isOnline={true} isBackendReachable={false} />);
    expect(screen.getByText(/trouble reaching the server/)).toBeInTheDocument();
  });

  it("the detail panel follows a standard disclosure pattern with exposed expanded state", async () => {
    const user = userEvent.setup();
    render(<OfflineModeIndicator {...baseProps} />);
    const toggle = screen.getByRole("button", { name: /offline/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Connectivity detail")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Connectivity detail")).toBeInTheDocument();
  });

  it("expanded detail shows last-synced time, queued count, and storage usage", async () => {
    const user = userEvent.setup();
    render(<OfflineModeIndicator {...baseProps} />);
    await user.click(screen.getByRole("button", { name: /offline/i }));

    expect(screen.getByText("Last synced: 2026-09-28 10:00")).toBeInTheDocument();
    expect(screen.getByText("Queued: 3 items")).toBeInTheDocument();
    expect(screen.getByText("Storage: 12 MB")).toBeInTheDocument();
  });

  it("shows a calm 'All caught up' state, not an empty-list explanation, when nothing is queued", async () => {
    const user = userEvent.setup();
    render(<OfflineModeIndicator {...baseProps} queuedCount={0} />);
    await user.click(screen.getByRole("button", { name: /offline/i }));
    expect(screen.getByText("Queued: All caught up")).toBeInTheDocument();
  });

  it("Retry connection calls onRetryConnection", async () => {
    const user = userEvent.setup();
    const onRetryConnection = vi.fn();
    render(<OfflineModeIndicator {...baseProps} onRetryConnection={onRetryConnection} />);
    await user.click(screen.getByRole("button", { name: /offline/i }));
    await user.click(screen.getByRole("button", { name: "Retry connection" }));
    expect(onRetryConnection).toHaveBeenCalledOnce();
  });

  it("Sync Status calls onJumpToSyncStatus", async () => {
    const user = userEvent.setup();
    const onJumpToSyncStatus = vi.fn();
    render(<OfflineModeIndicator {...baseProps} onJumpToSyncStatus={onJumpToSyncStatus} />);
    await user.click(screen.getByRole("button", { name: /offline/i }));
    await user.click(screen.getByRole("button", { name: "Sync Status" }));
    expect(onJumpToSyncStatus).toHaveBeenCalledOnce();
  });
});
