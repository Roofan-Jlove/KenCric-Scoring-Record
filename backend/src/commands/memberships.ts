/**
 * TASK-0095: generic CRUD for `memberships`
 * (`data-specification.md §3.3`, `api-specification.md §4/§5/§6/§7/§10`).
 *
 * `createMembership`/`updateMembership`/`getMembership`/`listMemberships`
 * mirror `organizations.ts`'s own structure directly (`TASK-0093`) --
 * same error constructors, same `PUT` create-or-update semantics, same
 * keyset-paginated list shape.
 *
 * Two deliberate exclusions, both real spec-mandated boundaries, not
 * sizing shortcuts:
 *
 * 1. `status` is absent from BOTH `CreateMembershipPayload` and
 *    `UpdateMembershipPayload` entirely -- `api-specification.md
 *    §10.2`'s own deviation note: "`status` is response-only on
 *    create (always starts `ACTIVE`); use `§11.3` to deactivate, not a
 *    `PUT` with `status=DEACTIVATED` directly." Structurally absent
 *    from the type, the same precedent `matches.ts` (`TASK-0039`) set
 *    for `state`/`result`.
 *
 * 2. `DELETE` is not implemented here at all. `data-specification.md
 *    §3.3`'s own Soft-deletion line is policy 2 (`status =
 *    DEACTIVATED`, never a row delete) -- a generic `DELETE` here
 *    would duplicate exactly what `api-specification.md §11.3`'s own
 *    dedicated, not-yet-built command endpoint owns. Left entirely to
 *    that future task rather than risking the two drifting apart.
 */

import { businessRuleValidationError, notFoundError, schemaValidationError, staleVersionError, type ProblemDetails } from "../authz/errors.js";

/**
 * `product-foundation.md §4`'s own 12-role table, normalized to the
 * `HEAD_SCORER`/`ASSISTANT_SCORER`/`UMPIRE` naming `domain-model.md`'s
 * own `VO-SIGNATURE` already uses as precedent for the other nine.
 * `GUEST` is included despite being a poor practical fit for a real
 * `memberships` row (device-local, no account) -- the spec says "the
 * 12," not "11 of the 12," and gives no textual exception; see this
 * task's own mint note for the full reasoning, including the
 * `system-architecture.md §3.9` tension this resolves in favour of
 * `data-specification.md`'s own schema table.
 */
export const VALID_ROLES = [
  "PLATFORM_ADMIN",
  "ORGANIZATION_ADMIN",
  "COMPETITION_ORGANIZER",
  "TEAM_MANAGER",
  "HEAD_SCORER",
  "ASSISTANT_SCORER",
  "UMPIRE",
  "COMMENTATOR",
  "STATISTICIAN",
  "PLAYER",
  "VIEWER",
  "GUEST",
] as const;

export type MembershipRole = (typeof VALID_ROLES)[number];

/**
 * `data-specification.md §3.3`'s field list, minus the pure-storage/
 * internal fields (`row_version`, `created_at/created_by/updated_at/
 * updated_by`) and the response-only `status` field (see this module's
 * own doc comment), per `api-specification.md §10.1`.
 */
export interface CreateMembershipPayload {
  id: string;
  userId: string;
  organizationId: string;
  roles?: string[];
}

export type MembershipStatus = "ACTIVE" | "DEACTIVATED";

export interface MembershipRow {
  id: string;
  userId: string;
  organizationId: string;
  roles: string[];
  status: MembershipStatus;
  /**
   * `data-specification.md §3.3` -- added by RCR, `TASK-0119`, resolving
   * `domain-model.md`'s own `ENT-MEMBERSHIP` attribute-list gap
   * (`invitedAt?`/`acceptedAt?`). Optional here (rather than required)
   * so every pre-existing `MembershipRow` literal in this module's own
   * tests and in `deactivateMember.ts`/`claimMatch.ts`'s own fixtures
   * keeps compiling unchanged -- null/absent for a membership created
   * by any path other than `invitations.ts`'s own `acceptInvitation`
   * (`TASK-0120`), which is every membership this module's own
   * `createMembership` itself still creates.
   */
  invitedAt?: string | null;
  acceptedAt?: string | null;
  rowVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface MembershipStore {
  get(id: string): MembershipRow | null;
  insert(row: MembershipRow): void;
  update(row: MembershipRow): void;
  list(): MembershipRow[];
  /** Backs the `UQ (user_id, organization_id)` constraint (§3.3). */
  findByUserAndOrg(userId: string, organizationId: string): MembershipRow | null;
}

const REQUIRED_FIELDS = ["id", "userId", "organizationId"] as const;

/** §4.1 schema layer: field presence -- runs before any domain logic. 400 on failure. */
export function validateMembershipSchema(payload: Partial<CreateMembershipPayload>, instance: string): ProblemDetails | null {
  for (const field of REQUIRED_FIELDS) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      return schemaValidationError(`Missing required field: ${field}`, instance);
    }
  }
  return null;
}

/** §4.1 business-rule layer: every entry of `roles`, if present, must be
 * one of `product-foundation.md §4`'s own 12 roles. 422 on failure. */
export function validateRoles(roles: readonly string[] | undefined, instance: string): ProblemDetails | null {
  if (!roles) return null;
  for (const role of roles) {
    if (!(VALID_ROLES as readonly string[]).includes(role)) {
      return businessRuleValidationError(`Invalid role: ${role} -- must be one of ${VALID_ROLES.join(", ")}`, instance);
    }
  }
  return null;
}

export type CreateMembershipResult =
  | { outcome: "created"; row: MembershipRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** The create half of `PUT /memberships/{id}`. */
export function createMembership(
  payload: Partial<CreateMembershipPayload>,
  store: MembershipStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): CreateMembershipResult {
  const schemaProblem = validateMembershipSchema(payload, instance);
  if (schemaProblem) return { outcome: "rejected", problem: schemaProblem };

  const validated = payload as CreateMembershipPayload;

  const rolesProblem = validateRoles(validated.roles, instance);
  if (rolesProblem) return { outcome: "rejected", problem: rolesProblem };

  if (store.get(validated.id)) {
    return {
      outcome: "rejected",
      problem: schemaValidationError(`A membership with id ${validated.id} already exists -- use the update path, not create`, instance),
    };
  }

  // §3.3's own UQ(user_id, organization_id) -- a distinct check from
  // the id-already-exists case above: a *different* id could still
  // collide on the same user+org pair.
  if (store.findByUserAndOrg(validated.userId, validated.organizationId)) {
    return {
      outcome: "rejected",
      problem: businessRuleValidationError(
        `A membership already exists for user ${validated.userId} in organization ${validated.organizationId}`,
        instance,
      ),
    };
  }

  const row: MembershipRow = {
    id: validated.id,
    userId: validated.userId,
    organizationId: validated.organizationId,
    roles: validated.roles ?? [],
    status: "ACTIVE",
    rowVersion: 1,
    createdAt: nowIso,
    createdBy: actorRef,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.insert(row);
  return { outcome: "created", row };
}

export interface UpdateMembershipPayload {
  rowVersion: number;
  roles?: string[];
}

export type UpdateMembershipResult =
  | { outcome: "updated"; row: MembershipRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** The update half of `PUT /memberships/{id}`. `roles` is the only
 * mutable field besides the fixed identity pair -- the caller sends
 * the full resulting array (additive-union semantics are the caller's
 * own responsibility to compute, same division of labor `UX-28`'s own
 * `addRole`/`removeRole` established at the UI layer). */
export function updateMembership(
  id: string,
  payload: UpdateMembershipPayload,
  store: MembershipStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): UpdateMembershipResult {
  const existing = store.get(id);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No membership visible with id ${id}`, instance) };
  }

  if (payload.rowVersion === undefined || payload.rowVersion === null) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: rowVersion", instance) };
  }

  if (payload.rowVersion !== existing.rowVersion) {
    return {
      outcome: "rejected",
      problem: staleVersionError(`expected row_version ${existing.rowVersion}, got ${payload.rowVersion}`, instance),
    };
  }

  const rolesProblem = validateRoles(payload.roles, instance);
  if (rolesProblem) return { outcome: "rejected", problem: rolesProblem };

  const updatedRow: MembershipRow = {
    ...existing,
    roles: payload.roles !== undefined ? payload.roles : existing.roles,
    rowVersion: existing.rowVersion + 1,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.update(updatedRow);
  return { outcome: "updated", row: updatedRow };
}

export type GetMembershipResult =
  | { outcome: "found"; row: MembershipRow }
  | { outcome: "rejected"; problem: ProblemDetails };

export function getMembership(id: string, store: MembershipStore, instance: string): GetMembershipResult {
  const row = store.get(id);
  if (!row) {
    return { outcome: "rejected", problem: notFoundError(`No membership visible with id ${id}`, instance) };
  }
  return { outcome: "found", row };
}

export interface ListMembershipsQuery {
  after?: string | null;
  limit?: number;
  organizationId?: string | null;
  userId?: string | null;
  status?: MembershipStatus | null;
}

export interface ListMembershipsResult {
  items: MembershipRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** §6's own defaults: `[DEFAULT] 50`, `[DEFAULT] max 200`. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** `GET /memberships`. Keyset-paginated by `id` ascending (§6);
 * `organizationId`/`userId`/`status` are all explicitly spec-named
 * filterable fields (§6), no gap to flag this time. */
export function listMemberships(query: ListMembershipsQuery, store: MembershipStore): ListMembershipsResult {
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let rows = store.list().slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (query.organizationId !== undefined && query.organizationId !== null) {
    rows = rows.filter((r) => r.organizationId === query.organizationId);
  }

  if (query.userId !== undefined && query.userId !== null) {
    rows = rows.filter((r) => r.userId === query.userId);
  }

  if (query.status !== undefined && query.status !== null) {
    rows = rows.filter((r) => r.status === query.status);
  }

  if (query.after) {
    const cursor = query.after;
    rows = rows.filter((r) => r.id > cursor);
  }

  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return { items: page, nextCursor, hasMore };
}

/** An in-memory MembershipStore for tests -- not a production adapter. */
export class InMemoryMembershipStore implements MembershipStore {
  private readonly rows = new Map<string, MembershipRow>();

  get(id: string): MembershipRow | null {
    return this.rows.get(id) ?? null;
  }

  insert(row: MembershipRow): void {
    this.rows.set(row.id, row);
  }

  update(row: MembershipRow): void {
    this.rows.set(row.id, row);
  }

  list(): MembershipRow[] {
    return Array.from(this.rows.values());
  }

  findByUserAndOrg(userId: string, organizationId: string): MembershipRow | null {
    for (const row of this.rows.values()) {
      if (row.userId === userId && row.organizationId === organizationId) return row;
    }
    return null;
  }
}
