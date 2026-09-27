import { describe, expect, it } from "vitest";
import {
  confirmDestructiveAction,
  isSettingEditable,
  matchesEligibleForPurge,
  shouldWarnStorageLimit,
  validatePasswordChange,
  type PurgeCandidateMatch,
} from "./settingsForm";

describe("isSettingEditable", () => {
  it("LOCAL settings are always editable, online or offline", () => {
    expect(isSettingEditable("LOCAL", false)).toBe(true);
    expect(isSettingEditable("LOCAL", true)).toBe(true);
  });

  it("ACCOUNT settings are editable online, disabled offline", () => {
    expect(isSettingEditable("ACCOUNT", false)).toBe(true);
    expect(isSettingEditable("ACCOUNT", true)).toBe(false);
  });
});

describe("confirmDestructiveAction", () => {
  it("rejects delete-account without explicit confirmation", () => {
    const result = confirmDestructiveAction("DELETE_ACCOUNT", false);
    expect(result.outcome).toBe("rejected");
  });

  it("rejects purge-storage without explicit confirmation", () => {
    const result = confirmDestructiveAction("PURGE_STORAGE", false);
    expect(result.outcome).toBe("rejected");
  });

  it("confirms once explicitly acknowledged", () => {
    expect(confirmDestructiveAction("DELETE_ACCOUNT", true)).toEqual({ outcome: "confirmed" });
    expect(confirmDestructiveAction("PURGE_STORAGE", true)).toEqual({ outcome: "confirmed" });
  });
});

describe("validatePasswordChange", () => {
  it("requires the current password", () => {
    const result = validatePasswordChange({ currentPassword: "", newPassword: "newpass1", confirmNewPassword: "newpass1" });
    expect(result).toEqual({ outcome: "invalid", reason: "Current password is required" });
  });

  it("requires a non-empty new password", () => {
    const result = validatePasswordChange({ currentPassword: "oldpass1", newPassword: "", confirmNewPassword: "" });
    expect(result.outcome).toBe("invalid");
  });

  it("requires the new password and confirmation to match", () => {
    const result = validatePasswordChange({ currentPassword: "oldpass1", newPassword: "newpass1", confirmNewPassword: "newpass2" });
    expect(result).toEqual({ outcome: "invalid", reason: "New password and confirmation do not match" });
  });

  it("is valid with a current password and a matching new/confirm pair", () => {
    const result = validatePasswordChange({ currentPassword: "oldpass1", newPassword: "newpass1", confirmNewPassword: "newpass1" });
    expect(result).toEqual({ outcome: "valid" });
  });
});

describe("shouldWarnStorageLimit", () => {
  it("false well under the threshold", () => {
    expect(shouldWarnStorageLimit(100, 1000)).toBe(false);
  });

  it("true at or above the 90% threshold", () => {
    expect(shouldWarnStorageLimit(900, 1000)).toBe(true);
    expect(shouldWarnStorageLimit(950, 1000)).toBe(true);
  });

  it("false when there is no configured limit", () => {
    expect(shouldWarnStorageLimit(500, 0)).toBe(false);
  });
});

describe("matchesEligibleForPurge", () => {
  const matches: PurgeCandidateMatch[] = [
    { id: "old-synced", date: "2025-01-01", isSynced: true },
    { id: "old-unsynced", date: "2025-01-01", isSynced: false },
    { id: "recent-synced", date: "2026-09-20", isSynced: true },
  ];

  it("selects only synced matches older than the retention window", () => {
    expect(matchesEligibleForPurge(matches, 30, "2026-09-28")).toEqual(["old-synced"]);
  });

  it("selects nothing when no match is old enough", () => {
    expect(matchesEligibleForPurge(matches, 3650, "2026-09-28")).toEqual([]);
  });
});
