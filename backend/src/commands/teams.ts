/**
 * TASK-0094: generic CRUD for `teams`
 * (`data-specification.md §4.1`, `api-specification.md §4/§5/§6/§7/§10`).
 *
 * `createTeam`/`updateTeam`/`getTeam`/`listTeams` mirror `organizations.ts`'s
 * own structure directly (`TASK-0093`) -- same error constructors, same
 * `PUT` create-or-update semantics, same keyset-paginated list shape.
 *
 * Unlike `organizations`, `teams` genuinely has a `DELETE` -- `data-
 * specification.md §4.1`'s own Soft-deletion line gives it a real,
 * fully-specified policy: "not applicable [no soft-delete] -- a team
 * with match history is never deleted; an unused ad-hoc team may be
 * hard-deleted by its creator only." `deleteTeam` below implements that
 * exactly, as two gates (no match history; caller is the creator), not
 * a general write-role check.
 */

import { authForbidden, businessRuleValidationError, notFoundError, schemaValidationError, staleVersionError, type ProblemDetails } from "../authz/errors.js";

/**
 * `data-specification.md §4.1`'s field list, minus the pure-storage/
 * internal fields (`row_version`, `created_at/created_by/updated_at/
 * updated_by`), per `api-specification.md §10.1`.
 */
export interface CreateTeamPayload {
  id: string;
  organizationId?: string | null;
  name: string;
  canonicalRef?: string | null;
}

export interface TeamRow {
  id: string;
  organizationId: string | null;
  name: string;
  canonicalRef: string | null;
  rowVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TeamStore {
  get(id: string): TeamRow | null;
  insert(row: TeamRow): void;
  update(row: TeamRow): void;
  remove(id: string): void;
  list(): TeamRow[];
  /** A real adapter queries `matches`/`squad_members` for any historical
   * reference to this team; the in-memory test store below exposes a
   * settable marker instead, per this task's own mint note. */
  hasMatchHistory(id: string): boolean;
}

const REQUIRED_FIELDS = ["id", "name"] as const;

/** §4.1 schema layer: field presence -- runs before any domain logic. 400 on failure. */
export function validateTeamSchema(payload: Partial<CreateTeamPayload>, instance: string): ProblemDetails | null {
  for (const field of REQUIRED_FIELDS) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      return schemaValidationError(`Missing required field: ${field}`, instance);
    }
  }
  return null;
}

export type CreateTeamResult =
  | { outcome: "created"; row: TeamRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** The create half of `PUT /teams/{id}`. */
export function createTeam(
  payload: Partial<CreateTeamPayload>,
  store: TeamStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): CreateTeamResult {
  const schemaProblem = validateTeamSchema(payload, instance);
  if (schemaProblem) return { outcome: "rejected", problem: schemaProblem };

  const validated = payload as CreateTeamPayload;

  if (store.get(validated.id)) {
    return {
      outcome: "rejected",
      problem: schemaValidationError(`A team with id ${validated.id} already exists -- use the update path, not create`, instance),
    };
  }

  const row: TeamRow = {
    id: validated.id,
    organizationId: validated.organizationId ?? null,
    name: validated.name,
    canonicalRef: validated.canonicalRef ?? null,
    rowVersion: 1,
    createdAt: nowIso,
    createdBy: actorRef,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.insert(row);
  return { outcome: "created", row };
}

export interface UpdateTeamPayload {
  rowVersion: number;
  organizationId?: string | null;
  name?: string;
  canonicalRef?: string | null;
}

export type UpdateTeamResult =
  | { outcome: "updated"; row: TeamRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** The update half of `PUT /teams/{id}`. Only fields present in
 * [payload] are changed (`undefined` = "leave unchanged"). */
export function updateTeam(
  id: string,
  payload: UpdateTeamPayload,
  store: TeamStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): UpdateTeamResult {
  const existing = store.get(id);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No team visible with id ${id}`, instance) };
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

  const updatedRow: TeamRow = {
    ...existing,
    organizationId: payload.organizationId !== undefined ? payload.organizationId : existing.organizationId,
    name: payload.name ?? existing.name,
    canonicalRef: payload.canonicalRef !== undefined ? payload.canonicalRef : existing.canonicalRef,
    rowVersion: existing.rowVersion + 1,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.update(updatedRow);
  return { outcome: "updated", row: updatedRow };
}

export type GetTeamResult =
  | { outcome: "found"; row: TeamRow }
  | { outcome: "rejected"; problem: ProblemDetails };

export function getTeam(id: string, store: TeamStore, instance: string): GetTeamResult {
  const row = store.get(id);
  if (!row) {
    return { outcome: "rejected", problem: notFoundError(`No team visible with id ${id}`, instance) };
  }
  return { outcome: "found", row };
}

export interface ListTeamsQuery {
  after?: string | null;
  limit?: number;
  organizationId?: string | null;
  nameSearch?: string | null;
}

export interface ListTeamsResult {
  items: TeamRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** §6's own defaults: `[DEFAULT] 50`, `[DEFAULT] max 200`. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** `GET /teams`. Keyset-paginated by `id` ascending (§6); `organizationId`
 * and `nameSearch` are both explicitly spec-named filterable fields (§6),
 * unlike `organizations`' filterable-fields gap. */
export function listTeams(query: ListTeamsQuery, store: TeamStore): ListTeamsResult {
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let rows = store.list().slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (query.organizationId !== undefined && query.organizationId !== null) {
    rows = rows.filter((r) => r.organizationId === query.organizationId);
  }

  if (query.nameSearch) {
    const needle = query.nameSearch.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(needle));
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

export type DeleteTeamResult =
  | { outcome: "deleted" }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * `DELETE /teams/{id}`. `data-specification.md §4.1`'s own policy,
 * exactly: a team with match history is never deleted (`422`, not a
 * silent no-op); an unused ad-hoc team may be hard-deleted, but only by
 * its own creator (`403` for anyone else). Checked in that order --
 * existence, then history, then authorship -- so the caller always
 * learns the most specific applicable reason first.
 */
export function deleteTeam(id: string, store: TeamStore, actorRef: string, instance: string): DeleteTeamResult {
  const existing = store.get(id);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No team visible with id ${id}`, instance) };
  }

  if (store.hasMatchHistory(id)) {
    return {
      outcome: "rejected",
      problem: businessRuleValidationError("A team with match history is never deleted", instance),
    };
  }

  if (existing.createdBy !== actorRef) {
    return {
      outcome: "rejected",
      problem: authForbidden("Only this team's own creator may delete it", instance),
    };
  }

  store.remove(id);
  return { outcome: "deleted" };
}

/** An in-memory TeamStore for tests -- not a production adapter. */
export class InMemoryTeamStore implements TeamStore {
  private readonly rows = new Map<string, TeamRow>();
  private readonly matchHistoryTeamIds = new Set<string>();

  get(id: string): TeamRow | null {
    return this.rows.get(id) ?? null;
  }

  insert(row: TeamRow): void {
    this.rows.set(row.id, row);
  }

  update(row: TeamRow): void {
    this.rows.set(row.id, row);
  }

  remove(id: string): void {
    this.rows.delete(id);
  }

  list(): TeamRow[] {
    return Array.from(this.rows.values());
  }

  hasMatchHistory(id: string): boolean {
    return this.matchHistoryTeamIds.has(id);
  }

  /** Test-only helper -- marks a team as having match history, so both
   * `deleteTeam` branches are exercisable without a real `matches` join. */
  markHasMatchHistory(id: string): void {
    this.matchHistoryTeamIds.add(id);
  }
}
