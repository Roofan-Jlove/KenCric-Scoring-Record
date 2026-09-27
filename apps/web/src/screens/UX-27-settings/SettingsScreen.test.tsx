import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./SettingsScreen";

function baseProps() {
  return {
    dateFormat: "DD/MM/YYYY",
    matchTimeZone: "Europe/London",
    onChangeDateFormat: vi.fn(),
    onChangeMatchTimeZone: vi.fn(),
    highContrastEnabled: false,
    onToggleHighContrast: vi.fn(),
    sunlightModeEnabled: false,
    onToggleSunlightMode: vi.fn(),
    confirmationsEnabled: true,
    onToggleConfirmations: vi.fn(),
    hapticsEnabled: true,
    onToggleHaptics: vi.fn(),
    storageUsedBytes: 100,
    storageTotalBytes: 1000,
    onPurgeStorage: vi.fn(),
    onChangePassword: vi.fn(),
    onExportPersonalData: vi.fn(),
    onDeleteAccount: vi.fn(),
    onSignOut: vi.fn(),
    isOffline: false,
  };
}

describe("SettingsScreen (UX-27)", () => {
  it("toggling high contrast calls the handler", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<SettingsScreen {...props} />);
    await user.click(screen.getByLabelText("High contrast / large text"));
    expect(props.onToggleHighContrast).toHaveBeenCalled();
  });

  it("shows a storage warning only when nearly full", () => {
    render(<SettingsScreen {...baseProps()} storageUsedBytes={950} storageTotalBytes={1000} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/nearly full/);
  });

  it("does not show a storage warning well under the threshold", () => {
    render(<SettingsScreen {...baseProps()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("delete account requires an explicit confirm step before the handler fires", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<SettingsScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(props.onDeleteAccount).not.toHaveBeenCalled();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(props.onDeleteAccount).toHaveBeenCalled();
  });

  it("purge storage requires an explicit confirm step before the handler fires", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<SettingsScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "Purge synced matches" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(props.onPurgeStorage).toHaveBeenCalled();
  });

  it("cancelling a destructive confirm does not call the handler", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<SettingsScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onDeleteAccount).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("password change shows an error and does not call the handler when current password is missing", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<SettingsScreen {...props} />);
    await user.type(screen.getByLabelText("New password"), "newpass1");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass1");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText("Current password is required")).toBeInTheDocument();
    expect(props.onChangePassword).not.toHaveBeenCalled();
  });

  it("password change calls the handler once valid", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<SettingsScreen {...props} />);
    await user.type(screen.getByLabelText("Current password"), "oldpass1");
    await user.type(screen.getByLabelText("New password"), "newpass1");
    await user.type(screen.getByLabelText("Confirm new password"), "newpass1");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(props.onChangePassword).toHaveBeenCalledWith("oldpass1", "newpass1");
  });

  it("account settings are disabled while offline, with an explanation", () => {
    render(<SettingsScreen {...baseProps()} isOffline={true} />);
    expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export my data" })).toBeDisabled();
    expect(screen.getByText("Account settings require an internet connection")).toBeInTheDocument();
  });

  it("local settings remain enabled while offline", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<SettingsScreen {...props} isOffline={true} />);
    await user.click(screen.getByLabelText("Sunlight mode"));
    expect(props.onToggleSunlightMode).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Purge synced matches" })).not.toBeDisabled();
  });

  it("sign out remains available while offline", () => {
    render(<SettingsScreen {...baseProps()} isOffline={true} />);
    expect(screen.getByRole("button", { name: "Sign out" })).not.toBeDisabled();
  });
});
