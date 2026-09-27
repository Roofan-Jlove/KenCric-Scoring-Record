/**
 * TASK-0089: `ux-specification.md UX-27` -- Settings. MVP subset only:
 * device preferences (FR-152/153/154/155, OFR-016) plus the account
 * actions with a real MVP-scope basis (FR-010/011). `FR-157` (language)
 * and `FR-158` (notifications) are V1/V2 respectively per `FA-8` and
 * are NOT built here -- see the backlog's own `§6.3` tracking entry.
 */

export type SettingKind = "LOCAL" | "ACCOUNT";

/** UX-27's own Offline behavior text: local/device preferences apply with no
 * network dependency; account-level (server-required) settings are disabled offline. */
export function isSettingEditable(kind: SettingKind, isOffline: boolean): boolean {
  return kind === "LOCAL" || !isOffline;
}

export type DestructiveAction = "DELETE_ACCOUNT" | "PURGE_STORAGE";

export type ConfirmDestructiveResult =
  | { outcome: "confirmed" }
  | { outcome: "rejected"; reason: string };

/** UX-27's own Validation text, verbatim: "Destructive actions (delete account,
 * purge storage) require an explicit confirm step." */
export function confirmDestructiveAction(
  action: DestructiveAction,
  hasExplicitlyConfirmed: boolean,
): ConfirmDestructiveResult {
  if (!hasExplicitlyConfirmed) {
    const label = action === "DELETE_ACCOUNT" ? "delete your account" : "purge local storage";
    return { outcome: "rejected", reason: `You must explicitly confirm before we ${label}` };
  }
  return { outcome: "confirmed" };
}

export interface PasswordChangeForm {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export type PasswordChangeResult =
  | { outcome: "valid" }
  | { outcome: "invalid"; reason: string };

/** UX-27's own Validation text, verbatim: "a password change requires the current password." */
export function validatePasswordChange(form: PasswordChangeForm): PasswordChangeResult {
  if (form.currentPassword.trim().length === 0) {
    return { outcome: "invalid", reason: "Current password is required" };
  }
  if (form.newPassword.trim().length === 0) {
    return { outcome: "invalid", reason: "New password is required" };
  }
  if (form.newPassword !== form.confirmNewPassword) {
    return { outcome: "invalid", reason: "New password and confirmation do not match" };
  }
  return { outcome: "valid" };
}

/** OFR-016: "Warn the user before local storage limits are reached." The spec
 * gives no specific threshold -- 90% of the limit is this task's own explicit
 * assumption, not a cited number. */
const STORAGE_WARNING_THRESHOLD_RATIO = 0.9;

export function shouldWarnStorageLimit(usedBytes: number, totalBytes: number): boolean {
  if (totalBytes <= 0) return false;
  return usedBytes / totalBytes >= STORAGE_WARNING_THRESHOLD_RATIO;
}

export interface PurgeCandidateMatch {
  id: string;
  date: string;
  isSynced: boolean;
}

/** FR-155's own acceptance criterion: "Given synced matches older than the
 * retention window, when purge is run, then their local copies are removed
 * and remain retrievable from the cloud." Un-synced matches are never eligible. */
export function matchesEligibleForPurge(
  matches: readonly PurgeCandidateMatch[],
  retentionDays: number,
  today: string,
): string[] {
  // Pure UTC date-string arithmetic -- avoids a local-timezone off-by-one
  // that `new Date(today).setDate(...)` + `.toISOString()` would introduce.
  const [year, month, day] = today.split("-").map(Number);
  const cutoffMs = Date.UTC(year, month - 1, day) - retentionDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString().slice(0, 10);
  return matches.filter((m) => m.isSynced && m.date < cutoffIso).map((m) => m.id);
}
