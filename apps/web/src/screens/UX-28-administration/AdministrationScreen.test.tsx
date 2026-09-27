import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdministrationScreen } from "./AdministrationScreen";
import type { AdminMember } from "./AdministrationScreen";

function baseProps() {
  const members: AdminMember[] = [{ id: "m1", name: "Alex", roles: ["HEAD_SCORER"] }];
  return {
    isOrgAdmin: true,
    isPlatformAdmin: false,
    activeImpersonation: null,
    onEndImpersonation: vi.fn(),
    members,
    onInviteMember: vi.fn(),
    onChangeRoles: vi.fn(),
    onDeactivateMember: vi.fn(),
    featureFlags: [],
    onToggleFeatureFlag: vi.fn(),
    referenceDataVersions: ["v1"],
    onPublishReferenceData: vi.fn(),
    impersonationConsents: {},
    onStartImpersonation: vi.fn(),
    currentAdminId: "admin-1",
    now: "2026-09-28T00:00:00Z",
    isOffline: false,
  };
}

describe("AdministrationScreen (UX-28)", () => {
  it("org-admins see the Members section, platform sections entirely absent", () => {
    render(<AdministrationScreen {...baseProps()} />);
    expect(screen.getByRole("heading", { name: "Members" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Feature flags" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Support impersonation" })).not.toBeInTheDocument();
  });

  it("platform-admins who are not org-admins see platform sections, Members entirely absent", () => {
    render(<AdministrationScreen {...baseProps()} isOrgAdmin={false} isPlatformAdmin={true} />);
    expect(screen.queryByRole("heading", { name: "Members" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Feature flags" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reference data" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Support impersonation" })).toBeInTheDocument();
  });

  it("deactivating a member requires an explicit confirm step", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AdministrationScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(props.onDeactivateMember).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(props.onDeactivateMember).toHaveBeenCalledWith("m1");
  });

  it("revoking a role requires an explicit confirm step, and only removes that role", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AdministrationScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "Revoke HEAD_SCORER" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(props.onChangeRoles).toHaveBeenCalledWith("m1", []);
  });

  it("granting a role is additive (keeps existing roles), not gated behind a confirm step", async () => {
    const user = userEvent.setup();
    const props = { ...baseProps(), members: [{ id: "m1", name: "Alex", roles: ["CAPTAIN"] as AdminMember["roles"] }] };
    render(<AdministrationScreen {...props} />);
    await user.click(screen.getByRole("button", { name: "Grant Head Scorer" }));
    expect(props.onChangeRoles).toHaveBeenCalledWith("m1", ["CAPTAIN", "HEAD_SCORER"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("publishing reference data always requests a new version id", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AdministrationScreen {...props} isPlatformAdmin={true} referenceDataVersions={["v1", "v2"]} />);
    await user.click(screen.getByRole("button", { name: "Publish new version" }));
    expect(props.onPublishReferenceData).toHaveBeenCalledWith("v3");
  });

  it("impersonation without stored consent shows an error and does not start", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(<AdministrationScreen {...props} isPlatformAdmin={true} />);
    await user.click(screen.getByRole("button", { name: "Impersonate Alex" }));
    expect(screen.getByRole("alert")).toHaveTextContent("No stored consent exists for this user");
    expect(props.onStartImpersonation).not.toHaveBeenCalled();
  });

  it("impersonation with unexpired consent starts and names both identities", async () => {
    const user = userEvent.setup();
    const props = baseProps();
    render(
      <AdministrationScreen
        {...props}
        isPlatformAdmin={true}
        impersonationConsents={{ m1: { userId: "m1", expiresAt: "2026-12-01T00:00:00Z" } }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Impersonate Alex" }));
    expect(props.onStartImpersonation).toHaveBeenCalledWith("m1", "admin-1 (impersonating m1)");
  });

  it("a persistent, labelled banner shows for the duration of an active impersonation", () => {
    render(<AdministrationScreen {...baseProps()} activeImpersonation={{ targetUserId: "m1", targetName: "Alex" }} />);
    expect(screen.getByLabelText("Active impersonation")).toHaveTextContent("Impersonating Alex");
  });

  it("write actions are disabled offline, read views remain visible", () => {
    render(<AdministrationScreen {...baseProps()} isOffline={true} />);
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeDisabled();
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });
});
