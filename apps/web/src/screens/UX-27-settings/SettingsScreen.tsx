import { useState } from "react";
import {
  confirmDestructiveAction,
  isSettingEditable,
  shouldWarnStorageLimit,
  validatePasswordChange,
  type DestructiveAction,
} from "./settingsForm";

/**
 * TASK-0089: `ux-specification.md UX-27` -- Settings, MVP subset. Styling
 * not applied, same scope boundary as every earlier screen this session.
 * Interface-language and notification-preference sections are deliberately
 * absent -- deferred (V1/V2) per the backlog's own `§6.3` tracking entry.
 */

export interface SettingsScreenProps {
  dateFormat: string;
  matchTimeZone: string;
  onChangeDateFormat: (format: string) => void;
  onChangeMatchTimeZone: (timeZone: string) => void;
  highContrastEnabled: boolean;
  onToggleHighContrast: () => void;
  sunlightModeEnabled: boolean;
  onToggleSunlightMode: () => void;
  confirmationsEnabled: boolean;
  onToggleConfirmations: () => void;
  hapticsEnabled: boolean;
  onToggleHaptics: () => void;
  storageUsedBytes: number;
  storageTotalBytes: number;
  onPurgeStorage: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => void;
  onExportPersonalData: () => void;
  onDeleteAccount: () => void;
  onSignOut: () => void;
  isOffline: boolean;
}

export function SettingsScreen({
  dateFormat,
  matchTimeZone,
  onChangeDateFormat,
  onChangeMatchTimeZone,
  highContrastEnabled,
  onToggleHighContrast,
  sunlightModeEnabled,
  onToggleSunlightMode,
  confirmationsEnabled,
  onToggleConfirmations,
  hapticsEnabled,
  onToggleHaptics,
  storageUsedBytes,
  storageTotalBytes,
  onPurgeStorage,
  onChangePassword,
  onExportPersonalData,
  onDeleteAccount,
  onSignOut,
  isOffline,
}: SettingsScreenProps) {
  const [pendingConfirm, setPendingConfirm] = useState<DestructiveAction | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const accountDisabled = !isSettingEditable("ACCOUNT", isOffline);
  const showStorageWarning = shouldWarnStorageLimit(storageUsedBytes, storageTotalBytes);

  function requestConfirm(action: DestructiveAction) {
    setPendingConfirm(action);
  }

  function handleConfirm() {
    if (!pendingConfirm) return;
    const result = confirmDestructiveAction(pendingConfirm, true);
    if (result.outcome === "confirmed") {
      if (pendingConfirm === "DELETE_ACCOUNT") onDeleteAccount();
      if (pendingConfirm === "PURGE_STORAGE") onPurgeStorage();
    }
    setPendingConfirm(null);
  }

  function handlePasswordSubmit() {
    const result = validatePasswordChange({ currentPassword, newPassword, confirmNewPassword });
    if (result.outcome === "invalid") {
      setPasswordError(result.reason);
      return;
    }
    setPasswordError(null);
    onChangePassword(currentPassword, newPassword);
  }

  return (
    <div>
      {isOffline && <p role="status">Offline — account settings are disabled until you reconnect</p>}

      <section aria-labelledby="section-datetime">
        <h2 id="section-datetime">Date &amp; time</h2>
        <label htmlFor="date-format">Date format</label>
        <select id="date-format" value={dateFormat} onChange={(e) => onChangeDateFormat(e.target.value)}>
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
        </select>

        <label htmlFor="match-timezone">Match time zone</label>
        <input id="match-timezone" value={matchTimeZone} onChange={(e) => onChangeMatchTimeZone(e.target.value)} />
      </section>

      <section aria-labelledby="section-accessibility">
        <h2 id="section-accessibility">Accessibility</h2>
        <label>
          <input type="checkbox" checked={highContrastEnabled} onChange={onToggleHighContrast} />
          High contrast / large text
        </label>
        <label>
          <input type="checkbox" checked={sunlightModeEnabled} onChange={onToggleSunlightMode} />
          Sunlight mode
        </label>
      </section>

      <section aria-labelledby="section-input">
        <h2 id="section-input">Scoring input</h2>
        <label>
          <input type="checkbox" checked={confirmationsEnabled} onChange={onToggleConfirmations} />
          Confirm before recording common runs
        </label>
        <label>
          <input type="checkbox" checked={hapticsEnabled} onChange={onToggleHaptics} />
          Haptics
        </label>
      </section>

      <section aria-labelledby="section-storage">
        <h2 id="section-storage">Storage</h2>
        <p>
          {storageUsedBytes} / {storageTotalBytes} bytes used
        </p>
        {showStorageWarning && <p role="alert">Local storage is nearly full — consider purging synced matches</p>}
        <button type="button" onClick={() => requestConfirm("PURGE_STORAGE")}>
          Purge synced matches
        </button>
      </section>

      <section aria-labelledby="section-account">
        <h2 id="section-account">Account</h2>
        <label htmlFor="current-password">Current password</label>
        <input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={accountDisabled} />
        <label htmlFor="new-password">New password</label>
        <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={accountDisabled} />
        <label htmlFor="confirm-new-password">Confirm new password</label>
        <input id="confirm-new-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={accountDisabled} />
        {passwordError && <p role="alert">{passwordError}</p>}
        <button type="button" onClick={handlePasswordSubmit} disabled={accountDisabled}>
          Change password
        </button>

        <button type="button" onClick={onExportPersonalData} disabled={accountDisabled}>
          Export my data
        </button>
        <button type="button" onClick={() => requestConfirm("DELETE_ACCOUNT")} disabled={accountDisabled}>
          Delete account
        </button>
        {accountDisabled && <p>Account settings require an internet connection</p>}

        <button type="button" onClick={onSignOut}>
          Sign out
        </button>
      </section>

      {pendingConfirm && (
        <div role="dialog" aria-label="Confirm">
          <p>
            {pendingConfirm === "DELETE_ACCOUNT"
              ? "This will permanently delete your account. Are you sure?"
              : "This will remove local copies of synced matches. Are you sure?"}
          </p>
          <button type="button" onClick={handleConfirm}>
            Confirm
          </button>
          <button type="button" onClick={() => setPendingConfirm(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
