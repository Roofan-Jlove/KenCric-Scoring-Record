/**
 * TASK-0120: `POST /organizations/{orgId}/invitations` and
 * `POST /invitations/{token}/accept` (`api-specification.md §11.5`) --
 * the sixth `§11` match-lifecycle command task, unblocked by
 * `TASK-0119`'s own schema RCR (`data-specification.md §3.4`
 * `invitations`; two new nullable columns on `memberships`).
 *
 * Two endpoints, one task, matching `§11.5`'s own single combined spec
 * entry (`TASK-0093`'s own "one spec entry, bundle the operations"
 * reasoning for `organizations`' four CRUD operations).
 *
 * **A real registry gap found and filled, the fourth instance of this
 * shape this session** (`TASK-0100`'s `invalidTransitionError`,
 * `TASK-0105`'s `reconciliationBlockedError`, now this task's own
 * `invitationExpiredError`): `§11.5`'s own text names a `410 Gone`
 * response for an expired invitation, explicitly distinguished from
 * `404` -- but `§5.2`'s own canonical registry table never lists this
 * code at all. Added to `errors.ts`, same `<domain>/<state>` naming
 * convention `reconciliationBlockedError` already set.
 *
 * **A deliberate non-check, flagged rather than silently assumed:**
 * `§11.5`'s own Authz line for *accept* ("authenticated as the invited
 * email") is prose, not named in `§11.5`'s own Errors line as part of
 * its own command-layer contract (unlike `TASK-0105`'s explicit `403`
 * for a non-Head-Scorer) -- per this session's own established default
 * (`FA-7`), left to the auth/RLS layer, not re-implemented here.
 * Send-side `Authz: org-admin` is likewise left to RLS.
 *
 * **Neither endpoint uses the `IdempotencyStore` pattern every other
 * `§11` command has used, a deliberate departure, not an oversight:**
 * `send` genuinely creates a new resource on every call (no stated
 * idempotency contract in `§11.5`'s own text, unlike every other `§11`
 * command); `accept`'s own natural idempotency key *is* the token
 * itself -- a second accept attempt on an already-`ACCEPTED` token is
 * correctly a `409` (re-running accept would otherwise mint a second
 * `memberships` row for the same invitation), not a silent replay.
 */

import { businessRuleValidationError, invalidTransitionError, invitationExpiredError, notFoundError, schemaValidationError, type ProblemDetails } from "../authz/errors.js";
import { VALID_ROLES, type MembershipRow, type MembershipStore } from "./memberships.js";

export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED";

export interface InvitationRow {
  id: string;
  organizationId: string;
  email: string;
  roles: string[];
  token: string;
  status: InvitationStatus;
  expiresAt: string;
  invitedAt: string;
  invitedBy: string;
  acceptedAt: string | null;
}

export interface InvitationStore {
  get(id: string): InvitationRow | null;
  getByToken(token: string): InvitationRow | null;
  insert(row: InvitationRow): void;
  update(row: InvitationRow): void;
}

export interface InviteMemberPayload {
  organizationId?: string;
  email?: string;
  roles?: string[];
  expiresAt?: string;
}

export type InviteMemberResult =
  | { outcome: "sent"; row: InvitationRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `POST /organizations/{orgId}/invitations`. Always creates a new row -- no idempotency contract stated. */
export function inviteMember(
  payload: InviteMemberPayload,
  store: InvitationStore,
  actorRef: string,
  newInvitationId: string,
  newToken: string,
  nowIso: string,
  instance: string,
): InviteMemberResult {
  if (!payload.organizationId) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: organizationId", instance) };
  }
  if (!payload.email) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: email", instance) };
  }
  if (!payload.expiresAt) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: expiresAt", instance) };
  }

  const roles = payload.roles ?? [];
  for (const role of roles) {
    if (!(VALID_ROLES as readonly string[]).includes(role)) {
      return { outcome: "rejected", problem: businessRuleValidationError(`Invalid role: ${role} -- must be one of ${VALID_ROLES.join(", ")}`, instance) };
    }
  }

  const row: InvitationRow = {
    id: newInvitationId,
    organizationId: payload.organizationId,
    email: payload.email,
    roles,
    token: newToken,
    status: "PENDING",
    expiresAt: payload.expiresAt,
    invitedAt: nowIso,
    invitedBy: actorRef,
    acceptedAt: null,
  };

  store.insert(row);
  return { outcome: "sent", row };
}

export type AcceptInvitationResult =
  | { outcome: "accepted"; row: MembershipRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * `POST /invitations/{token}/accept`. Looks the invitation up by
 * token; `410`s if past `expiresAt`; `409`s if not `PENDING` (already
 * accepted or revoked -- a genuinely different concern from a
 * reused-token *replay*, since a token is single-use by design, not
 * safely no-oppable the way `deactivateMember`'s own repeat-action is).
 *
 * `acceptingUserId` is the authenticated caller's real `users.id` --
 * `§11.5`'s own Authz line ("authenticated as the invited email")
 * describes an auth-layer check this module has no session plumbing to
 * perform itself; it is taken as an explicit caller-supplied input,
 * same division of labor every other `§6.1`/`§11` module uses for
 * `actorRef`, not derived from `invitation.email` (which is a contact
 * address, never a `users.id`).
 */
export function acceptInvitation(
  token: string,
  acceptingUserId: string,
  invitationStore: InvitationStore,
  membershipStore: MembershipStore,
  newMembershipId: string,
  nowIso: string,
  instance: string,
): AcceptInvitationResult {
  const invitation = invitationStore.getByToken(token);
  if (!invitation) {
    return { outcome: "rejected", problem: notFoundError(`No invitation visible for token ${token}`, instance) };
  }

  if (invitation.status !== "PENDING") {
    return {
      outcome: "rejected",
      problem: invalidTransitionError(`Invitation ${invitation.id} is ${invitation.status}, not PENDING -- cannot accept`, instance),
    };
  }

  if (invitation.expiresAt < nowIso) {
    return { outcome: "rejected", problem: invitationExpiredError(`Invitation ${invitation.id} expired at ${invitation.expiresAt}`, instance) };
  }

  const membershipRow: MembershipRow = {
    id: newMembershipId,
    userId: acceptingUserId,
    organizationId: invitation.organizationId,
    roles: invitation.roles,
    status: "ACTIVE",
    invitedAt: invitation.invitedAt,
    acceptedAt: nowIso,
    rowVersion: 1,
    createdAt: nowIso,
    createdBy: invitation.invitedBy,
    updatedAt: nowIso,
    updatedBy: invitation.invitedBy,
  };

  membershipStore.insert(membershipRow);

  const updatedInvitation: InvitationRow = { ...invitation, status: "ACCEPTED", acceptedAt: nowIso };
  invitationStore.update(updatedInvitation);

  return { outcome: "accepted", row: membershipRow };
}

/** An in-memory InvitationStore for tests -- not a production adapter. */
export class InMemoryInvitationStore implements InvitationStore {
  private readonly rows = new Map<string, InvitationRow>();

  get(id: string): InvitationRow | null {
    return this.rows.get(id) ?? null;
  }

  getByToken(token: string): InvitationRow | null {
    for (const row of this.rows.values()) {
      if (row.token === token) return row;
    }
    return null;
  }

  insert(row: InvitationRow): void {
    this.rows.set(row.id, row);
  }

  update(row: InvitationRow): void {
    this.rows.set(row.id, row);
  }
}
