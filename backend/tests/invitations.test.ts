import { describe, expect, it } from "vitest";
import { InMemoryMembershipStore } from "../src/commands/memberships.js";
import { acceptInvitation, InMemoryInvitationStore, inviteMember, type InviteMemberPayload } from "../src/commands/invitations.js";

describe("inviteMember (TASK-0120)", () => {
  it("sends a new invitation", () => {
    const store = new InMemoryInvitationStore();
    const payload: InviteMemberPayload = { organizationId: "org-1", email: "new@example.com", roles: ["UMPIRE"], expiresAt: "2026-10-10T00:00:00Z" };

    const result = inviteMember(payload, store, "admin-1", "inv-1", "token-1", "2026-10-03T00:00:00Z", "req-1");

    expect(result.outcome).toBe("sent");
    if (result.outcome !== "sent") throw new Error("unreachable");
    expect(result.row.status).toBe("PENDING");
    expect(result.row.token).toBe("token-1");
    expect(result.row.acceptedAt).toBeNull();
  });

  it("defaults roles to an empty array when omitted", () => {
    const store = new InMemoryInvitationStore();
    const result = inviteMember({ organizationId: "org-1", email: "new@example.com", expiresAt: "later" }, store, "admin-1", "inv-1", "token-1", "now", "req-1");
    expect(result.outcome).toBe("sent");
    if (result.outcome !== "sent") throw new Error("unreachable");
    expect(result.row.roles).toEqual([]);
  });

  it("missing organizationId is a schema failure (400)", () => {
    const store = new InMemoryInvitationStore();
    const result = inviteMember({ email: "new@example.com", expiresAt: "later" }, store, "admin-1", "inv-1", "token-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing email is a schema failure (400)", () => {
    const store = new InMemoryInvitationStore();
    const result = inviteMember({ organizationId: "org-1", expiresAt: "later" }, store, "admin-1", "inv-1", "token-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("missing expiresAt is a schema failure (400)", () => {
    const store = new InMemoryInvitationStore();
    const result = inviteMember({ organizationId: "org-1", email: "new@example.com" }, store, "admin-1", "inv-1", "token-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(400);
  });

  it("an invalid role is a business-rule failure (422)", () => {
    const store = new InMemoryInvitationStore();
    const result = inviteMember({ organizationId: "org-1", email: "new@example.com", roles: ["NOT_A_ROLE"], expiresAt: "later" }, store, "admin-1", "inv-1", "token-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(422);
  });
});

describe("acceptInvitation (TASK-0120)", () => {
  function sentInvitation(invitationStore: InMemoryInvitationStore, expiresAt = "2026-10-10T00:00:00Z") {
    const result = inviteMember(
      { organizationId: "org-1", email: "new@example.com", roles: ["UMPIRE"], expiresAt },
      invitationStore,
      "admin-1",
      "inv-1",
      "token-1",
      "2026-10-03T00:00:00Z",
      "req-1",
    );
    if (result.outcome !== "sent") throw new Error("seed failed");
    return result.row;
  }

  it("accepts a pending, unexpired invitation and creates the new membership row", () => {
    const invitationStore = new InMemoryInvitationStore();
    const membershipStore = new InMemoryMembershipStore();
    sentInvitation(invitationStore);

    const result = acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1");

    expect(result.outcome).toBe("accepted");
    if (result.outcome !== "accepted") throw new Error("unreachable");
    expect(result.row.status).toBe("ACTIVE");
    expect(result.row.userId).toBe("user-99");
    expect(result.row.organizationId).toBe("org-1");
    expect(result.row.roles).toEqual(["UMPIRE"]);
    expect(result.row.invitedAt).toBe("2026-10-03T00:00:00Z");
    expect(result.row.acceptedAt).toBe("2026-10-05T00:00:00Z");
  });

  it("marks the invitation ACCEPTED after a successful accept", () => {
    const invitationStore = new InMemoryInvitationStore();
    const membershipStore = new InMemoryMembershipStore();
    sentInvitation(invitationStore);

    acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1");

    const invitation = invitationStore.get("inv-1");
    expect(invitation?.status).toBe("ACCEPTED");
    expect(invitation?.acceptedAt).toBe("2026-10-05T00:00:00Z");
  });

  it("404s on an unknown token", () => {
    const invitationStore = new InMemoryInvitationStore();
    const membershipStore = new InMemoryMembershipStore();
    const result = acceptInvitation("no-such-token", "user-99", invitationStore, membershipStore, "mem-1", "now", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(404);
  });

  it("410s on an expired invitation", () => {
    const invitationStore = new InMemoryInvitationStore();
    const membershipStore = new InMemoryMembershipStore();
    sentInvitation(invitationStore, "2026-10-01T00:00:00Z");

    const result = acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(410);
  });

  it("409s when re-accepting an already-ACCEPTED invitation", () => {
    const invitationStore = new InMemoryInvitationStore();
    const membershipStore = new InMemoryMembershipStore();
    sentInvitation(invitationStore);
    acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1");

    const result = acceptInvitation("token-1", "user-100", invitationStore, membershipStore, "mem-2", "later", "req-2");
    expect(result.outcome).toBe("rejected");
    if (result.outcome !== "rejected") throw new Error("unreachable");
    expect(result.problem.status).toBe(409);
  });

  it("does not create a second membership row on a rejected re-accept", () => {
    const invitationStore = new InMemoryInvitationStore();
    const membershipStore = new InMemoryMembershipStore();
    sentInvitation(invitationStore);
    acceptInvitation("token-1", "user-99", invitationStore, membershipStore, "mem-1", "2026-10-05T00:00:00Z", "req-1");

    acceptInvitation("token-1", "user-100", invitationStore, membershipStore, "mem-2", "later", "req-2");

    expect(membershipStore.get("mem-2")).toBeNull();
    expect(membershipStore.get("mem-1")).not.toBeNull();
  });
});
