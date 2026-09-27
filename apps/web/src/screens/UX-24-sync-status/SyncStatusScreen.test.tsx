import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SyncStatusScreen } from "./SyncStatusScreen";
import type { PushEventOutcome } from "./syncStatusState";

const rejectedOutcome: PushEventOutcome = { eventId: "e2", status: "REJECTED", rejectionReason: "Validation failed" };

const baseProps = {
  isOnline: true,
  isBackendReachable: true,
  isSyncing: false,
  rejectedCount: 0,
  outcomes: [] as PushEventOutcome[],
  eventBallReference: () => null,
  globalQueueDepth: 0,
  lastFullSyncTimestamp: "2026-09-28 10:00",
  hasNeverSynced: false,
  onTriggerManualSync: vi.fn(),
  onRetryFailedBatch: vi.fn(),
  onViewEventDetail: vi.fn(),
  onSignIn: vi.fn(),
};

describe("SyncStatusScreen (UX-24)", () => {
  it("shows the idle-synced status when everything is caught up", () => {
    render(<SyncStatusScreen {...baseProps} />);
    expect(screen.getByRole("status")).toHaveTextContent("Synced");
  });

  it("clicking Sync now calls onTriggerManualSync", async () => {
    const user = userEvent.setup();
    const onTriggerManualSync = vi.fn();
    render(<SyncStatusScreen {...baseProps} onTriggerManualSync={onTriggerManualSync} />);
    await user.click(screen.getByRole("button", { name: "Sync now" }));
    expect(onTriggerManualSync).toHaveBeenCalledOnce();
  });

  it("every rejected event shows the specific reason in plain language, never a raw error code", () => {
    render(<SyncStatusScreen {...baseProps} rejectedCount={1} outcomes={[rejectedOutcome]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Some items failed to sync");
    expect(screen.getByText("This item couldn't be synced: Validation failed")).toBeInTheDocument();
  });

  it("each error-list entry's accessible name states the ball reference and the problem plainly, when available", () => {
    render(
      <SyncStatusScreen
        {...baseProps}
        rejectedCount={1}
        outcomes={[rejectedOutcome]}
        eventBallReference={(id) => (id === "e2" ? "12.4" : null)}
      />,
    );
    expect(screen.getByRole("button", { name: "Over 12.4: This item couldn't be synced: Validation failed" })).toBeInTheDocument();
  });

  it("clicking a rejected event calls onViewEventDetail with its id", async () => {
    const user = userEvent.setup();
    const onViewEventDetail = vi.fn();
    render(<SyncStatusScreen {...baseProps} rejectedCount={1} outcomes={[rejectedOutcome]} onViewEventDetail={onViewEventDetail} />);
    await user.click(screen.getByText("This item couldn't be synced: Validation failed"));
    expect(onViewEventDetail).toHaveBeenCalledWith("e2");
  });

  it("Retry failed batch is shown only when something is rejected", () => {
    render(<SyncStatusScreen {...baseProps} />);
    expect(screen.queryByRole("button", { name: "Retry failed batch" })).not.toBeInTheDocument();
  });

  it("a brand-new/never-synced user sees the account/cloud-sync explanation and a sign-in offer", () => {
    render(<SyncStatusScreen {...baseProps} hasNeverSynced={true} />);
    expect(screen.getByText(/cloud sync/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("distinguishes backend-degraded from fully offline", () => {
    render(<SyncStatusScreen {...baseProps} isBackendReachable={false} />);
    expect(screen.getByRole("status")).toHaveTextContent("Server unreachable");
  });
});
