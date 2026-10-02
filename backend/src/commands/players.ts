/**
 * TASK-0096: generic CRUD for `players`
 * (`data-specification.md §4.2`, `api-specification.md §4/§5/§6/§7/§10`).
 *
 * `createPlayer`/`updatePlayer`/`getPlayer`/`listPlayers` mirror
 * `teams.ts`'s own create/update/list/get-one shape directly
 * (`TASK-0094`) -- same error constructors, same `PUT` create-or-update
 * semantics, same keyset-paginated list shape, nullable `organizationId`
 * for a local/ad-hoc player.
 *
 * `status`/`mergedIntoPlayerId` are structurally absent from BOTH
 * `CreatePlayerPayload` and `UpdatePlayerPayload` -- `api-specification.md
 * §10.2`'s own deviation note: "`merged_into_player_id`/`status=MERGED`
 * are response-only -- a merge is a dedicated command (`§11.6`), never a
 * plain field edit." Every row is created `status: "ACTIVE"`,
 * `mergedIntoPlayerId: null`; `§11.6`'s own future, not-yet-minted
 * command is their only legitimate mutator. `DELETE /players/{id}` is
 * correspondingly NOT implemented here, same shape `memberships.ts`
 * (`TASK-0095`) already established for its own deactivation.
 *
 * The table's own `CK: merged_into_player_id IS NOT NULL ⇔ status =
 * MERGED` needs no business-rule check in this module at all -- since
 * neither field is ever accepted via this module's own payloads, the
 * CK can never be violated through this code path.
 *
 * `dob` is stored as a plain nullable date with no redaction logic --
 * `NFR-039` ("Minors' data handling," `Should·P2`) governs consent/
 * reduced-visibility display rules, but is not MVP scope per `FA-8`;
 * see this task's own mint note for the `(NFR-033)` citation this
 * table's own field comment uses instead (a discovery-level number,
 * not the SRS-consolidated one).
 */

import { notFoundError, schemaValidationError, staleVersionError, type ProblemDetails } from "../authz/errors.js";

/**
 * `data-specification.md §4.2`'s field list, minus the pure-storage/
 * internal fields (`row_version`, `created_at/created_by/updated_at/
 * updated_by`) and the response-only `status`/`merged_into_player_id`
 * fields (see this module's own doc comment), per `api-specification.md
 * §10.1`.
 */
export interface CreatePlayerPayload {
  id: string;
  organizationId?: string | null;
  name: string;
  dob?: string | null;
  photoRef?: string | null;
}

export type PlayerStatus = "ACTIVE" | "MERGED";

export interface PlayerRow {
  id: string;
  organizationId: string | null;
  name: string;
  dob: string | null;
  photoRef: string | null;
  status: PlayerStatus;
  mergedIntoPlayerId: string | null;
  rowVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface PlayerStore {
  get(id: string): PlayerRow | null;
  insert(row: PlayerRow): void;
  update(row: PlayerRow): void;
  list(): PlayerRow[];
}

const REQUIRED_FIELDS = ["id", "name"] as const;

/** §4.1 schema layer: field presence -- runs before any domain logic. 400 on failure. */
export function validatePlayerSchema(payload: Partial<CreatePlayerPayload>, instance: string): ProblemDetails | null {
  for (const field of REQUIRED_FIELDS) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      return schemaValidationError(`Missing required field: ${field}`, instance);
    }
  }
  return null;
}

export type CreatePlayerResult =
  | { outcome: "created"; row: PlayerRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** The create half of `PUT /players/{id}`. */
export function createPlayer(
  payload: Partial<CreatePlayerPayload>,
  store: PlayerStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): CreatePlayerResult {
  const schemaProblem = validatePlayerSchema(payload, instance);
  if (schemaProblem) return { outcome: "rejected", problem: schemaProblem };

  const validated = payload as CreatePlayerPayload;

  if (store.get(validated.id)) {
    return {
      outcome: "rejected",
      problem: schemaValidationError(`A player with id ${validated.id} already exists -- use the update path, not create`, instance),
    };
  }

  const row: PlayerRow = {
    id: validated.id,
    organizationId: validated.organizationId ?? null,
    name: validated.name,
    dob: validated.dob ?? null,
    photoRef: validated.photoRef ?? null,
    status: "ACTIVE",
    mergedIntoPlayerId: null,
    rowVersion: 1,
    createdAt: nowIso,
    createdBy: actorRef,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.insert(row);
  return { outcome: "created", row };
}

export interface UpdatePlayerPayload {
  rowVersion: number;
  organizationId?: string | null;
  name?: string;
  dob?: string | null;
  photoRef?: string | null;
}

export type UpdatePlayerResult =
  | { outcome: "updated"; row: PlayerRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** The update half of `PUT /players/{id}`. Only fields present in
 * [payload] are changed (`undefined` = "leave unchanged"). */
export function updatePlayer(
  id: string,
  payload: UpdatePlayerPayload,
  store: PlayerStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): UpdatePlayerResult {
  const existing = store.get(id);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No player visible with id ${id}`, instance) };
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

  const updatedRow: PlayerRow = {
    ...existing,
    organizationId: payload.organizationId !== undefined ? payload.organizationId : existing.organizationId,
    name: payload.name ?? existing.name,
    dob: payload.dob !== undefined ? payload.dob : existing.dob,
    photoRef: payload.photoRef !== undefined ? payload.photoRef : existing.photoRef,
    rowVersion: existing.rowVersion + 1,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.update(updatedRow);
  return { outcome: "updated", row: updatedRow };
}

export type GetPlayerResult =
  | { outcome: "found"; row: PlayerRow }
  | { outcome: "rejected"; problem: ProblemDetails };

export function getPlayer(id: string, store: PlayerStore, instance: string): GetPlayerResult {
  const row = store.get(id);
  if (!row) {
    return { outcome: "rejected", problem: notFoundError(`No player visible with id ${id}`, instance) };
  }
  return { outcome: "found", row };
}

export interface ListPlayersQuery {
  after?: string | null;
  limit?: number;
  organizationId?: string | null;
  nameSearch?: string | null;
}

export interface ListPlayersResult {
  items: PlayerRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** §6's own defaults: `[DEFAULT] 50`, `[DEFAULT] max 200`. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** `GET /players`. Keyset-paginated by `id` ascending (§6); `organizationId`
 * and `nameSearch` are both explicitly spec-named filterable fields (§6). */
export function listPlayers(query: ListPlayersQuery, store: PlayerStore): ListPlayersResult {
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

/** An in-memory PlayerStore for tests -- not a production adapter. */
export class InMemoryPlayerStore implements PlayerStore {
  private readonly rows = new Map<string, PlayerRow>();

  get(id: string): PlayerRow | null {
    return this.rows.get(id) ?? null;
  }

  insert(row: PlayerRow): void {
    this.rows.set(row.id, row);
  }

  update(row: PlayerRow): void {
    this.rows.set(row.id, row);
  }

  list(): PlayerRow[] {
    return Array.from(this.rows.values());
  }
}
