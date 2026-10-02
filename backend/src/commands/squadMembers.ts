/**
 * TASK-0097: generic CRUD for `squad_members`
 * (`data-specification.md §4.3`, `api-specification.md §4/§5/§10`).
 *
 * The most structurally different resource in this cluster: `§4.3`'s
 * own field table has no `id` and no `row_version` at all -- the PK is
 * the composite `(team_id, player_id)`, and its own prose says plainly,
 * "no update fields -- this is an add/remove join, not an edited
 * entity." `api-specification.md §10.2`'s own deviation note confirms
 * the URL shape: `{id}` in the generic pattern is `{playerId}` under
 * `/teams/{teamId}/squad-members`.
 *
 * With no `row_version` to check, the general "a stale row_version is
 * 409" contract (`§10.1`) cannot apply here -- `addSquadMember` is a
 * pure idempotent upsert of `roleHint` (the only mutable, non-key
 * field), never a `409`. `roleHint` is "display only -- never
 * authoritative" per `§4.3`, so a lost-update race on it is low-stakes
 * by the spec's own framing. `createdAt`/`createdBy` are preserved
 * across a repeat `PUT` on the same pair -- set once, never touched
 * again, the same write-once provenance principle every other
 * resource's own `created_at`/`created_by` already follows.
 *
 * `removeSquadMember` is a plain, ungated hard delete: `§4.3`'s own
 * Soft-deletion line states removing a squad-list entry "never
 * orphans a historical reference" (that lives in `batter_card_lines`/
 * `bowler_card_lines`, not here) -- unlike `teams.ts`'s two-gate
 * `deleteTeam`, there is nothing to check beyond existence.
 */

import { notFoundError, schemaValidationError, type ProblemDetails } from "../authz/errors.js";

export interface SquadMemberRow {
  teamId: string;
  playerId: string;
  roleHint: string | null;
  createdAt: string;
  createdBy: string;
}

export interface SquadMemberStore {
  get(teamId: string, playerId: string): SquadMemberRow | null;
  upsert(row: SquadMemberRow): void;
  remove(teamId: string, playerId: string): void;
  /** Every squad member of one team -- the path's own implicit filter. */
  listByTeam(teamId: string): SquadMemberRow[];
}

export type AddSquadMemberResult =
  | { outcome: "added"; row: SquadMemberRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * `PUT /teams/{teamId}/squad-members/{playerId}`. Idempotent upsert --
 * no `row_version`, never a `409`. An existing pair keeps its original
 * `createdAt`/`createdBy`; only `roleHint` is replaced.
 */
export function addSquadMember(
  teamId: string,
  playerId: string,
  roleHint: string | null | undefined,
  store: SquadMemberStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): AddSquadMemberResult {
  if (!teamId) return { outcome: "rejected", problem: schemaValidationError("Missing required field: teamId", instance) };
  if (!playerId) return { outcome: "rejected", problem: schemaValidationError("Missing required field: playerId", instance) };

  const existing = store.get(teamId, playerId);

  const row: SquadMemberRow = existing
    ? { ...existing, roleHint: roleHint ?? null }
    : {
        teamId,
        playerId,
        roleHint: roleHint ?? null,
        createdAt: nowIso,
        createdBy: actorRef,
      };

  store.upsert(row);
  return { outcome: "added", row };
}

export type GetSquadMemberResult =
  | { outcome: "found"; row: SquadMemberRow }
  | { outcome: "rejected"; problem: ProblemDetails };

export function getSquadMember(teamId: string, playerId: string, store: SquadMemberStore, instance: string): GetSquadMemberResult {
  const row = store.get(teamId, playerId);
  if (!row) {
    return { outcome: "rejected", problem: notFoundError(`No squad member visible for team ${teamId}, player ${playerId}`, instance) };
  }
  return { outcome: "found", row };
}

/** `GET /teams/{teamId}/squad-members`. A squad is small by nature --
 * no keyset-pagination envelope, a deliberate simplification for a
 * bounded-size list, not an oversight. */
export function listSquadMembers(teamId: string, store: SquadMemberStore): SquadMemberRow[] {
  return store.listByTeam(teamId);
}

export type RemoveSquadMemberResult =
  | { outcome: "removed" }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `DELETE /teams/{teamId}/squad-members/{playerId}`. Plain hard
 * delete -- no gate, since removing this row never orphans a
 * historical reference (§4.3's own text). */
export function removeSquadMember(teamId: string, playerId: string, store: SquadMemberStore, instance: string): RemoveSquadMemberResult {
  const existing = store.get(teamId, playerId);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No squad member visible for team ${teamId}, player ${playerId}`, instance) };
  }
  store.remove(teamId, playerId);
  return { outcome: "removed" };
}

function compositeKey(teamId: string, playerId: string): string {
  return `${teamId}::${playerId}`;
}

/** An in-memory SquadMemberStore for tests -- not a production adapter. */
export class InMemorySquadMemberStore implements SquadMemberStore {
  private readonly rows = new Map<string, SquadMemberRow>();

  get(teamId: string, playerId: string): SquadMemberRow | null {
    return this.rows.get(compositeKey(teamId, playerId)) ?? null;
  }

  upsert(row: SquadMemberRow): void {
    this.rows.set(compositeKey(row.teamId, row.playerId), row);
  }

  remove(teamId: string, playerId: string): void {
    this.rows.delete(compositeKey(teamId, playerId));
  }

  listByTeam(teamId: string): SquadMemberRow[] {
    return Array.from(this.rows.values()).filter((r) => r.teamId === teamId);
  }
}
