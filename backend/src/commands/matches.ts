/**
 * TASK-0039: generic CRUD create for `matches`
 * (`data-specification.md §5.1`, `api-specification.md §4/§5/§10`).
 *
 * TWO CORRECTIONS to this task's own backlog entry, made deliberately,
 * not silently followed:
 *
 * 1. The task's own title/Files field says "POST /matches" -- but
 *    `api-specification.md §10.1` is explicit: "there is no
 *    server-assigning `POST /{resource}` for any table in this
 *    section." Every resource in §10.2 (matches included) uses
 *    `PUT /{resource}/{id}`, **client-supplied id**, create-or-update.
 *    `data-specification.md §5.1` independently confirms this for
 *    matches specifically: "`id` | uuid | ... Client-generated -- a
 *    match is always created offline-first." This module implements
 *    the CREATE half of that `PUT` semantics (an update, with its
 *    `row_version` optimistic-concurrency check, is a natural
 *    extension not built by this task -- its own Goal is "creates a
 *    `matches` row," the create case only).
 *
 * 2. The task's own Context needed field cites "§9 (validation layers,
 *    error registry)" -- §9 is actually "Versioning," unrelated. The
 *    real sections are §4 ("Validation," the three-layer model) and §5
 *    ("Error codes," the registry), used here instead.
 *
 * A further correction inside the task's own Expected Behavior: "a
 * payload missing a required field returns the exact 422" -- per §4.1's
 * own table, a missing/malformed field is a SCHEMA validation failure
 * (400 Bad Request), not a business-rule one (422). 422 is reserved for
 * a well-formed payload that violates a domain rule (e.g. this table's
 * own `CK`: `home_team_id <> away_team_id`) -- implemented per §4.1's
 * actual three-layer distinction, not the task's own paraphrase.
 *
 * TASK-0044 extends this module with the update half of `PUT`
 * (`updateMatch`) -- see that function's own doc comment.
 */

import { businessRuleValidationError, notFoundError, schemaValidationError, staleVersionError, type ProblemDetails } from "../authz/errors.js";

export type MatchFormat = "T20" | "ODI" | "T10" | "THE_HUNDRED" | "CUSTOM" | "FIRST_CLASS";
export type RainMethod = "DLS_STANDARD" | "NONE";

/**
 * data-specification.md §5.1's field list, minus response-only/
 * server-computed fields (`claim_status`, `officials_summary`,
 * `toss_winner_team_id`/`toss_decision` -- set later via `CMD-RECORD-
 * TOSS`, §11 not §10 -- `state`, `result`, `row_version`,
 * `created_at`/`created_by`/`updated_at`/`updated_by`), per §10.1's
 * "the field table... minus the pure-storage/internal fields."
 */
export interface CreateMatchPayload {
  id: string;
  organizationId: string | null;
  originDeviceId: string;
  homeTeamId: string;
  awayTeamId: string;
  format: MatchFormat;
  oversAllotted?: number | null;
  homeXi?: unknown | null;
  awayXi?: unknown | null;
  conditionsProfile?: unknown | null;
  conditionsProfileVersion?: number | null;
  dlsTableVersion?: number | null;
  rainMethod?: RainMethod;
  venue?: string | null;
  scheduledStart?: string | null;
  matchTimezone: string;
  minOversForResult?: number | null;
}

export interface MatchRow {
  id: string;
  organizationId: string | null;
  originDeviceId: string;
  claimStatus: "GUEST" | "CLAIMED";
  homeTeamId: string;
  awayTeamId: string;
  homeXi: unknown | null;
  awayXi: unknown | null;
  format: MatchFormat;
  oversAllotted: number | null;
  conditionsProfile: unknown | null;
  conditionsProfileVersion: number | null;
  dlsTableVersion: number | null;
  rainMethod: RainMethod;
  tossWinnerTeamId: string | null;
  tossDecision: string | null;
  venue: string | null;
  scheduledStart: string | null;
  matchTimezone: string;
  minOversForResult: number | null;
  state: "SCHEDULED";
  result: null;
  rowVersion: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface MatchStore {
  get(id: string): MatchRow | null;
  insert(row: MatchRow): void;
  /** TASK-0044: a distinct method from `insert`, even though the in-memory test adapter implements both identically -- a real DB adapter uses a different statement (UPDATE vs INSERT), and keeping the interface honest about intent matters more than the test double's own simplicity. */
  update(row: MatchRow): void;
}

const REQUIRED_FIELDS = ["id", "originDeviceId", "homeTeamId", "awayTeamId", "format", "matchTimezone"] as const;
const VALID_FORMATS: readonly MatchFormat[] = ["T20", "ODI", "T10", "THE_HUNDRED", "CUSTOM", "FIRST_CLASS"];

/** §4.1 schema layer: field presence, type, format -- runs before any domain logic. 400 on failure. */
export function validateMatchSchema(payload: Partial<CreateMatchPayload>, instance: string): ProblemDetails | null {
  for (const field of REQUIRED_FIELDS) {
    const value = payload[field];
    if (value === undefined || value === null || value === "") {
      return schemaValidationError(`Missing required field: ${field}`, instance);
    }
  }
  if (!VALID_FORMATS.includes(payload.format as MatchFormat)) {
    return schemaValidationError(`format must be one of ${VALID_FORMATS.join(", ")}`, instance);
  }
  return null;
}

/** §4.1 business-rule layer: domain rules not dependent on concurrent state -- here, the table's own CK constraint. 422 on failure. */
export function validateMatchBusinessRules(payload: CreateMatchPayload, instance: string): ProblemDetails | null {
  if (payload.homeTeamId === payload.awayTeamId) {
    return businessRuleValidationError("home_team_id and away_team_id must differ (CK)", instance);
  }
  return null;
}

export type CreateMatchResult =
  | { outcome: "created"; row: MatchRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * The create half of `PUT /matches/{id}`. [nowIso] and [instance] are
 * caller-supplied rather than read from a real clock/UUID source here
 * -- same determinism-boundary discipline `shared/`'s `ClockPort`/
 * `IdPort` (`TASK-0016`) already established, kept explicit at this
 * layer too rather than reaching for `Date.now()`/`crypto.randomUUID()`
 * directly.
 */
export function createMatch(
  payload: Partial<CreateMatchPayload>,
  store: MatchStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): CreateMatchResult {
  const schemaProblem = validateMatchSchema(payload, instance);
  if (schemaProblem) return { outcome: "rejected", problem: schemaProblem };

  const validated = payload as CreateMatchPayload;

  const businessProblem = validateMatchBusinessRules(validated, instance);
  if (businessProblem) return { outcome: "rejected", problem: businessProblem };

  if (store.get(validated.id)) {
    // §10.1: PUT is create-or-update by client-supplied id. An
    // existing id means this call is actually an update, which needs
    // the row_version optimistic-concurrency check -- a different,
    // not-yet-built code path (this function's own scope is create).
    return {
      outcome: "rejected",
      problem: schemaValidationError(`A match with id ${validated.id} already exists -- use the update path, not create`, instance),
    };
  }

  const row: MatchRow = {
    id: validated.id,
    organizationId: validated.organizationId ?? null,
    originDeviceId: validated.originDeviceId,
    claimStatus: validated.organizationId ? "CLAIMED" : "GUEST",
    homeTeamId: validated.homeTeamId,
    awayTeamId: validated.awayTeamId,
    homeXi: validated.homeXi ?? null,
    awayXi: validated.awayXi ?? null,
    format: validated.format,
    oversAllotted: validated.oversAllotted ?? null,
    conditionsProfile: validated.conditionsProfile ?? null,
    conditionsProfileVersion: validated.conditionsProfileVersion ?? null,
    dlsTableVersion: validated.dlsTableVersion ?? null,
    rainMethod: validated.rainMethod ?? "NONE",
    tossWinnerTeamId: null,
    tossDecision: null,
    venue: validated.venue ?? null,
    scheduledStart: validated.scheduledStart ?? null,
    matchTimezone: validated.matchTimezone,
    minOversForResult: validated.minOversForResult ?? null,
    state: "SCHEDULED",
    result: null,
    rowVersion: 1,
    createdAt: nowIso,
    createdBy: actorRef,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.insert(row);
  return { outcome: "created", row };
}

/**
 * TASK-0044: `matches` update, the other half of `PUT /matches/{id}`'s
 * create-or-update semantics `TASK-0039` deliberately deferred.
 *
 * data-specification.md §5.1's fields a client may update -- `id`,
 * `originDeviceId`, `claimStatus` (set once at create, never client-
 * editable after), `state`/`result` (derived, `MBR-07`/`MBR-11`), and
 * `toss_winner_team_id`/`toss_decision` (set via `CMD-RECORD-TOSS`,
 * §11, not this generic endpoint) are excluded -- everything else
 * `CreateMatchPayload` accepts is updatable here too, plus the
 * required `rowVersion` (§10.1: "required on PUT for an update").
 */
export interface UpdateMatchPayload {
  rowVersion: number;
  homeTeamId?: string;
  awayTeamId?: string;
  format?: MatchFormat;
  oversAllotted?: number | null;
  homeXi?: unknown | null;
  awayXi?: unknown | null;
  conditionsProfile?: unknown | null;
  conditionsProfileVersion?: number | null;
  dlsTableVersion?: number | null;
  rainMethod?: RainMethod;
  venue?: string | null;
  scheduledStart?: string | null;
  matchTimezone?: string;
  minOversForResult?: number | null;
}

export type UpdateMatchResult =
  | { outcome: "updated"; row: MatchRow }
  | { outcome: "rejected"; problem: ProblemDetails };

const FROZEN_ONCE_SET_FIELDS = ["homeXi", "awayXi", "conditionsProfile", "conditionsProfileVersion", "dlsTableVersion"] as const;

function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * `§10.2`'s Matches row: `home_xi`/`away_xi`/`toss_*`/`conditions_
 * profile*` are "write-once-then-locked... frozen at first ball."
 * `toss_*` is excluded entirely above (not this endpoint's field at
 * all). For the rest: this generic CRUD layer has no visibility into
 * `match_events` (whether a first ball has actually been recorded) --
 * as a conservative, FLAGGED APPROXIMATION of "at first ball," once one
 * of these fields is already non-null, a `PUT` attempting to change it
 * to a genuinely different value is rejected. This is stricter than
 * the real rule in one respect (it would also block a legitimate
 * pre-first-ball correction to an already-set field), but it never
 * permits the one thing `§10.2` actually forbids -- changing a frozen
 * field after it has been meaningfully set. Closing that gap precisely
 * needs a first-ball-recorded signal this endpoint doesn't have; flagged
 * here rather than silently assumed equivalent to the real rule.
 */
function validateFrozenFields(existing: MatchRow, payload: UpdateMatchPayload, instance: string): ProblemDetails | null {
  for (const field of FROZEN_ONCE_SET_FIELDS) {
    if (!(field in payload)) continue;
    const oldValue = existing[field];
    const newValue = payload[field];
    if (oldValue !== null && oldValue !== undefined && !jsonEqual(oldValue, newValue)) {
      return businessRuleValidationError(`${field} is frozen once set (BR-017/MINV-05)`, instance);
    }
  }
  return null;
}

/**
 * The update half of `PUT /matches/{id}`. Only fields present in
 * [payload] are changed (`undefined` = "leave unchanged"); [id] is the
 * path parameter, matching `PUT /{resource}/{id}`'s own shape.
 */
export function updateMatch(
  id: string,
  payload: UpdateMatchPayload,
  store: MatchStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): UpdateMatchResult {
  const existing = store.get(id);
  if (!existing) {
    // §5.2's own registry: identical response whether the resource
    // truly doesn't exist or RLS merely hides it -- never distinguish.
    return { outcome: "rejected", problem: notFoundError(`No match visible with id ${id}`, instance) };
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

  const frozenFieldProblem = validateFrozenFields(existing, payload, instance);
  if (frozenFieldProblem) return { outcome: "rejected", problem: frozenFieldProblem };

  const resultingHomeTeamId = payload.homeTeamId ?? existing.homeTeamId;
  const resultingAwayTeamId = payload.awayTeamId ?? existing.awayTeamId;
  if (resultingHomeTeamId === resultingAwayTeamId) {
    return {
      outcome: "rejected",
      problem: businessRuleValidationError("home_team_id and away_team_id must differ (CK)", instance),
    };
  }

  const updatedRow: MatchRow = {
    ...existing,
    homeTeamId: resultingHomeTeamId,
    awayTeamId: resultingAwayTeamId,
    format: payload.format ?? existing.format,
    oversAllotted: payload.oversAllotted !== undefined ? payload.oversAllotted : existing.oversAllotted,
    homeXi: payload.homeXi !== undefined ? payload.homeXi : existing.homeXi,
    awayXi: payload.awayXi !== undefined ? payload.awayXi : existing.awayXi,
    conditionsProfile: payload.conditionsProfile !== undefined ? payload.conditionsProfile : existing.conditionsProfile,
    conditionsProfileVersion:
      payload.conditionsProfileVersion !== undefined ? payload.conditionsProfileVersion : existing.conditionsProfileVersion,
    dlsTableVersion: payload.dlsTableVersion !== undefined ? payload.dlsTableVersion : existing.dlsTableVersion,
    rainMethod: payload.rainMethod ?? existing.rainMethod,
    venue: payload.venue !== undefined ? payload.venue : existing.venue,
    scheduledStart: payload.scheduledStart !== undefined ? payload.scheduledStart : existing.scheduledStart,
    matchTimezone: payload.matchTimezone ?? existing.matchTimezone,
    minOversForResult: payload.minOversForResult !== undefined ? payload.minOversForResult : existing.minOversForResult,
    rowVersion: existing.rowVersion + 1,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  store.update(updatedRow);
  return { outcome: "updated", row: updatedRow };
}

/** An in-memory MatchStore for tests -- not a production adapter. */
export class InMemoryMatchStore implements MatchStore {
  private readonly rows = new Map<string, MatchRow>();

  get(id: string): MatchRow | null {
    return this.rows.get(id) ?? null;
  }

  insert(row: MatchRow): void {
    this.rows.set(row.id, row);
  }

  update(row: MatchRow): void {
    this.rows.set(row.id, row);
  }
}
