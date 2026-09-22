import { describe, expect, it } from "vitest";
import { computeRoleContext, type MembershipRow } from "../src/authz/roleContext.js";
import { authorize } from "../src/authz/authorize.js";

describe("computeRoleContext (TASK-0013)", () => {
  it("includes ACTIVE memberships, keyed by organization", () => {
    const memberships: MembershipRow[] = [
      { organizationId: "org-1", roles: ["SCORER"], status: "ACTIVE" },
    ];
    const ctx = computeRoleContext("user-1", memberships);
    expect(ctx.userId).toBe("user-1");
    expect(ctx.organizations["org-1"]).toEqual({ roles: ["SCORER"] });
  });

  it("excludes DEACTIVATED memberships entirely (BR-024: no new actions)", () => {
    const memberships: MembershipRow[] = [
      { organizationId: "org-1", roles: ["ORG_ADMIN"], status: "DEACTIVATED" },
    ];
    const ctx = computeRoleContext("user-1", memberships);
    expect(ctx.organizations["org-1"]).toBeUndefined();
  });

  it("handles a user with no memberships at all", () => {
    const ctx = computeRoleContext("user-1", []);
    expect(ctx.organizations).toEqual({});
  });

  it("handles multiple organizations independently", () => {
    const memberships: MembershipRow[] = [
      { organizationId: "org-1", roles: ["SCORER"], status: "ACTIVE" },
      { organizationId: "org-2", roles: ["ORG_ADMIN"], status: "ACTIVE" },
    ];
    const ctx = computeRoleContext("user-1", memberships);
    expect(Object.keys(ctx.organizations).sort()).toEqual(["org-1", "org-2"]);
  });
});

describe("authorize (TASK-0014)", () => {
  it("authorizes when the user holds one of the required roles", () => {
    const ctx = computeRoleContext("user-1", [
      { organizationId: "org-1", roles: ["SCORER"], status: "ACTIVE" },
    ]);
    const result = authorize(
      { roleContext: ctx, organizationId: "org-1", requiredRoles: ["SCORER", "ORG_ADMIN"] },
      "test-instance-1",
    );
    expect(result.authorized).toBe(true);
  });

  it("denies with auth/forbidden (403) when the user has no membership in the organization", () => {
    const ctx = computeRoleContext("user-1", []);
    const result = authorize(
      { roleContext: ctx, organizationId: "org-1", requiredRoles: ["SCORER"] },
      "test-instance-2",
    );
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.problem.status).toBe(403);
      expect(result.problem.type).toContain("auth/forbidden");
      expect(result.problem.instance).toBe("test-instance-2");
    }
  });

  it("denies when the user has membership but lacks the required role", () => {
    const ctx = computeRoleContext("user-1", [
      { organizationId: "org-1", roles: ["SCORER"], status: "ACTIVE" },
    ]);
    const result = authorize(
      { roleContext: ctx, organizationId: "org-1", requiredRoles: ["ORG_ADMIN"] },
      "test-instance-3",
    );
    expect(result.authorized).toBe(false);
  });

  it("does not leak role/organization specifics in the client-facing detail (anti-enumeration)", () => {
    const ctx = computeRoleContext("user-1", []);
    const result = authorize(
      { roleContext: ctx, organizationId: "secret-org-id", requiredRoles: ["ORG_ADMIN"] },
      "test-instance-4",
    );
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.problem.detail).not.toContain("secret-org-id");
      expect(result.problem.detail).not.toContain("ORG_ADMIN");
    }
  });
});
