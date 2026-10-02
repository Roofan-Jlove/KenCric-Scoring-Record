/**
 * TASK-0098: generic CRUD for `officials`
 * (`data-specification.md §5.2`, `api-specification.md §4/§5/§6/§7/§10`).
 *
 * `createOfficial`/`updateOfficial`/`getOfficial`/`listOfficials` mirror
 * `teams.ts`'s own shape directly (`TASK-0094`) -- same error
 * constructors, same `PUT` create-or-update semantics, same keyset-
 * paginated list shape.
 *
 * `deleteOfficial` is a single-gate delete, not the two-gate shape
 * `teams.ts` uses -- `data-specification.md §5.2`'s own Soft-deletion
 * line names only an existence/no-assignment check ("a never-assigned
 * official may be hard-deleted"), with no "by its creator only"
 * restriction `teams`' own policy explicitly adds.
 *
 * `listOfficials` filters by `organizationId`, not `matchId` --
 * `api-specification.md §6`'s own "Filterable fields" sentence reads
 * "officials/match_officials -> matchId" as if both resources shared
 * the filter, but `§5.2`'s own field table has no `match_id` column
 * at all on `officials`; a `matchId` filter here would be inventing a
 * capability the schema cannot support. `organizationId` (§5.2's own
 * `IX: organization_id`) is the real filterable field for this
 * resource; `matchId` filtering belongs entirely to `match_officials`
 * (§5.3, its own future task).
 */

import { businessRuleValidationError, notFoundError, schemaValidationError, staleVersionError, type ProblemDetails } from "../authz/errors.js";

/**
 * `data-specification.md §5.2`'s field list, minus the pure-storage/
 * internal fields (`row_version`, `created_at/created_by/updated_at/
 * updated_by`), per `api-specification.md §10.1`.
 */
export interface CreateOfficialPayload {
  id: string;
  organizationId?: string | null;
  userId?: string | null;
  name: string;
}

export interface OfficialRow {
  id: string;
  organizationId: string | null;
  userId: string | null;
  name: string;
  rowVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface OfficialStore {
  get(id: string): OfficialRow | null;
  insert(row: OfficialRow): void;
  update(row: OfficialRow): void;
  remove(id: string): void;
  list(): OfficialRow[];
  /** A real adapter queries `match_officials` for any historical
   * assignment of this official; the in-memory test store below
   * exposes a settable marker instead, same shape as `TeamStore.
   * hasMatchHistory` (`TASK-0094`). */
  hasMatchAssignment(id: string): boolean;
}

const REQUIRED_FIELDS = ["id", "name"] as const;

/** §4.1 schema layer: field presence -- runs before any domain logic. 400 on failure. */
export function validateOfficialSchema(payload: Partial<CreateOfficialPayload>, instance: string): ProblemDetails | null {
  for (const field of REQUIRED_FIELDS) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      return schemaValidationError(`Missing required field: ${field}`, instance);
    }
  }
  return null;
}

export type CreateOfficialResult =
  | { outcome: "created"; row: OfficialRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** The create half of `PUT /officials/{id}`. */
export function createOfficial(
  payload: Partial<CreateOfficialPayload>,
  store: OfficialStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): CreateOfficialResult {
  const schemaProblem = validateOfficialSchema(payload, instance);
  if (schemaProblem) return { outcome: "rejected", problem: schemaProblem };

  const validated = payload as CreateOfficialPayload;

  if (store.get(validated.id)) {
    return {
      outcome: "rejected",
      problem: schemaValidationError(`An official with id ${validated.id} already exists -- use the update path, not create`, instance),
    };
  }

  const row: OfficialRow = {
    id: validated.id,
    organizationId: validated.organizationId ?? null,
    userId: validated.userId ?? null,
    name: validated.name,
    rowVersion: 1,
    createdAt: nowIso,
    createdBy: actorRef,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.insert(row);
  return { outcome: "created", row };
}

export interface UpdateOfficialPayload {
  rowVersion: number;
  organizationId?: string | null;
  userId?: string | null;
  name?: string;
}

export type UpdateOfficialResult =
  | { outcome: "updated"; row: OfficialRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** The update half of `PUT /officials/{id}`. Only fields present in
 * [payload] are changed (`undefined` = "leave unchanged"). */
export function updateOfficial(
  id: string,
  payload: UpdateOfficialPayload,
  store: OfficialStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): UpdateOfficialResult {
  const existing = store.get(id);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No official visible with id ${id}`, instance) };
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

  if (payload.name !== undefined && (payload.name === null || payload.name === "")) {
    return { outcome: "rejected", problem: schemaValidationError("name must not be empty", instance) };
  }

  const updatedRow: OfficialRow = {
    ...existing,
    organizationId: payload.organizationId !== undefined ? payload.organizationId : existing.organizationId,
    userId: payload.userId !== undefined ? payload.userId : existing.userId,
    name: payload.name ?? existing.name,
    rowVersion: existing.rowVersion + 1,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.update(updatedRow);
  return { outcome: "updated", row: updatedRow };
}

export type GetOfficialResult =
  | { outcome: "found"; row: OfficialRow }
  | { outcome: "rejected"; problem: ProblemDetails };

export function getOfficial(id: string, store: OfficialStore, instance: string): GetOfficialResult {
  const row = store.get(id);
  if (!row) {
    return { outcome: "rejected", problem: notFoundError(`No official visible with id ${id}`, instance) };
  }
  return { outcome: "found", row };
}

export interface ListOfficialsQuery {
  after?: string | null;
  limit?: number;
  organizationId?: string | null;
}

export interface ListOfficialsResult {
  items: OfficialRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** §6's own defaults: `[DEFAULT] 50`, `[DEFAULT] max 200`. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** `GET /officials`. Keyset-paginated by `id` ascending (§6);
 * `organizationId` is the real filterable field for this resource --
 * see this module's own doc comment for why `matchId` is not. */
export function listOfficials(query: ListOfficialsQuery, store: OfficialStore): ListOfficialsResult {
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let rows = store.list().slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (query.organizationId !== undefined && query.organizationId !== null) {
    rows = rows.filter((r) => r.organizationId === query.organizationId);
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

export type DeleteOfficialResult =
  | { outcome: "deleted" }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * `DELETE /officials/{id}`. `data-specification.md §5.2`'s own
 * policy, exactly: a never-assigned official may be hard-deleted; one
 * with any match assignment is refused (`422`), never a silent
 * no-op. No authorship restriction -- the spec names none for this
 * resource, unlike `teams`'.
 */
export function deleteOfficial(id: string, store: OfficialStore, instance: string): DeleteOfficialResult {
  const existing = store.get(id);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No official visible with id ${id}`, instance) };
  }

  if (store.hasMatchAssignment(id)) {
    return {
      outcome: "rejected",
      problem: businessRuleValidationError("An official with a match assignment is never deleted", instance),
    };
  }

  store.remove(id);
  return { outcome: "deleted" };
}

/** An in-memory OfficialStore for tests -- not a production adapter. */
export class InMemoryOfficialStore implements OfficialStore {
  private readonly rows = new Map<string, OfficialRow>();
  private readonly assignedOfficialIds = new Set<string>();

  get(id: string): OfficialRow | null {
    return this.rows.get(id) ?? null;
  }

  insert(row: OfficialRow): void {
    this.rows.set(row.id, row);
  }

  update(row: OfficialRow): void {
    this.rows.set(row.id, row);
  }

  remove(id: string): void {
    this.rows.delete(id);
  }

  list(): OfficialRow[] {
    return Array.from(this.rows.values());
  }

  hasMatchAssignment(id: string): boolean {
    return this.assignedOfficialIds.has(id);
  }

  /** Test-only helper -- marks an official as having a match
   * assignment, so both `deleteOfficial` branches are exercisable
   * without a real `match_officials` join. */
  markHasMatchAssignment(id: string): void {
    this.assignedOfficialIds.add(id);
  }
}
