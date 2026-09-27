import { describe, expect, it } from "vitest";
import {
  addRole,
  confirmAdminDestructiveAction,
  impersonationAuditActor,
  isAdminActionAvailable,
  isOrgAdmin,
  nextReferenceDataVersion,
  removeRole,
  requestImpersonation,
  visibleAdminSections,
  type ImpersonationConsent,
} from "./administrationForm";

describe("isOrgAdmin", () => {
  it("true only when ORG_ADMIN is among the roles", () => {
    expect(isOrgAdmin(["ORG_ADMIN", "HEAD_SCORER"])).toBe(true);
    expect(isOrgAdmin(["HEAD_SCORER"])).toBe(false);
  });
});

describe("visibleAdminSections", () => {
  it("org-admins see MEMBERS only, platform sections entirely absent", () => {
    expect(visibleAdminSections(true, false)).toEqual(["MEMBERS"]);
  });

  it("platform-admins see the platform sections, MEMBERS entirely absent if not also an org-admin", () => {
    expect(visibleAdminSections(false, true)).toEqual(["FEATURE_FLAGS", "REFERENCE_DATA", "IMPERSONATION"]);
  });

  it("a user with both roles sees everything", () => {
    expect(visibleAdminSections(true, true)).toEqual(["MEMBERS", "FEATURE_FLAGS", "REFERENCE_DATA", "IMPERSONATION"]);
  });

  it("neither role sees nothing", () => {
    expect(visibleAdminSections(false, false)).toEqual([]);
  });
});

describe("addRole / removeRole -- the additive model", () => {
  it("adding a role never removes an existing one", () => {
    expect(addRole(["HEAD_SCORER"], "CAPTAIN")).toEqual(["HEAD_SCORER", "CAPTAIN"]);
  });

  it("adding an already-held role does not duplicate it", () => {
    expect(addRole(["HEAD_SCORER"], "HEAD_SCORER")).toEqual(["HEAD_SCORER"]);
  });

  it("removing a role leaves every other role intact", () => {
    expect(removeRole(["HEAD_SCORER", "CAPTAIN"], "CAPTAIN")).toEqual(["HEAD_SCORER"]);
  });
});

describe("confirmAdminDestructiveAction", () => {
  it("rejects deactivation without explicit confirmation", () => {
    expect(confirmAdminDestructiveAction("DEACTIVATE_MEMBER", false).outcome).toBe("rejected");
  });

  it("rejects role revocation without explicit confirmation", () => {
    expect(confirmAdminDestructiveAction("REVOKE_ROLE", false).outcome).toBe("rejected");
  });

  it("confirms once explicitly acknowledged", () => {
    expect(confirmAdminDestructiveAction("DEACTIVATE_MEMBER", true)).toEqual({ outcome: "confirmed" });
  });
});

describe("requestImpersonation", () => {
  it("refuses with no stored consent", () => {
    const result = requestImpersonation(null, "2026-09-28T00:00:00Z");
    expect(result).toEqual({ outcome: "refused", reason: "No stored consent exists for this user" });
  });

  it("refuses with an expired consent", () => {
    const consent: ImpersonationConsent = { userId: "u1", expiresAt: "2026-09-01T00:00:00Z" };
    const result = requestImpersonation(consent, "2026-09-28T00:00:00Z");
    expect(result).toEqual({ outcome: "refused", reason: "The stored consent has expired" });
  });

  it("starts with an unexpired consent", () => {
    const consent: ImpersonationConsent = { userId: "u1", expiresAt: "2026-12-01T00:00:00Z" };
    expect(requestImpersonation(consent, "2026-09-28T00:00:00Z")).toEqual({ outcome: "started" });
  });
});

describe("impersonationAuditActor", () => {
  it("names both identities", () => {
    expect(impersonationAuditActor("admin-1", "user-42")).toBe("admin-1 (impersonating user-42)");
  });
});

describe("nextReferenceDataVersion", () => {
  it("starts at v1 with no existing versions", () => {
    expect(nextReferenceDataVersion([])).toBe("v1");
  });

  it("increments past the highest existing version, never overwriting", () => {
    expect(nextReferenceDataVersion(["v1", "v2"])).toBe("v3");
  });

  it("ignores non-matching ids when computing the next version", () => {
    expect(nextReferenceDataVersion(["initial", "v5"])).toBe("v6");
  });
});

describe("isAdminActionAvailable", () => {
  it("READ actions are always available", () => {
    expect(isAdminActionAvailable("READ", true)).toBe(true);
  });

  it("WRITE actions are disabled offline", () => {
    expect(isAdminActionAvailable("WRITE", false)).toBe(true);
    expect(isAdminActionAvailable("WRITE", true)).toBe(false);
  });
});
