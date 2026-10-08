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
import { businessRuleValidationError, notFoundError, schemaValidationError, staleVersionError } from "./errors.js";
const REQUIRED_FIELDS = ["id", "originDeviceId", "homeTeamId", "awayTeamId", "format", "matchTimezone"];
const VALID_FORMATS = ["T20", "ODI", "T10", "THE_HUNDRED", "CUSTOM", "FIRST_CLASS"];
/** §4.1 schema layer: field presence, type, format -- runs before any domain logic. 400 on failure. */
export function validateMatchSchema(payload, instance) {
    for (const field of REQUIRED_FIELDS) {
        const value = payload[field];
        if (value === undefined || value === null || value === "") {
            return schemaValidationError(`Missing required field: ${field}`, instance);
        }
    }
    if (!VALID_FORMATS.includes(payload.format)) {
        return schemaValidationError(`format must be one of ${VALID_FORMATS.join(", ")}`, instance);
    }
    return null;
}
/** §4.1 business-rule layer: domain rules not dependent on concurrent state -- here, the table's own CK constraint. 422 on failure. */
export function validateMatchBusinessRules(payload, instance) {
    if (payload.homeTeamId === payload.awayTeamId) {
        return businessRuleValidationError("home_team_id and away_team_id must differ (CK)", instance);
    }
    return null;
}
/**
 * The create half of `PUT /matches/{id}`. [nowIso] and [instance] are
 * caller-supplied rather than read from a real clock/UUID source here
 * -- same determinism-boundary discipline `shared/`'s `ClockPort`/
 * `IdPort` (`TASK-0016`) already established, kept explicit at this
 * layer too rather than reaching for `Date.now()`/`crypto.randomUUID()`
 * directly.
 */
export function createMatch(payload, store, actorRef, nowIso, instance) {
    const schemaProblem = validateMatchSchema(payload, instance);
    if (schemaProblem)
        return { outcome: "rejected", problem: schemaProblem };
    const validated = payload;
    const businessProblem = validateMatchBusinessRules(validated, instance);
    if (businessProblem)
        return { outcome: "rejected", problem: businessProblem };
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
    const row = {
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
const FROZEN_ONCE_SET_FIELDS = ["homeXi", "awayXi", "conditionsProfile", "conditionsProfileVersion", "dlsTableVersion"];
function jsonEqual(a, b) {
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
function validateFrozenFields(existing, payload, instance) {
    for (const field of FROZEN_ONCE_SET_FIELDS) {
        if (!(field in payload))
            continue;
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
export function updateMatch(id, payload, store, actorRef, nowIso, instance) {
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
    if (frozenFieldProblem)
        return { outcome: "rejected", problem: frozenFieldProblem };
    const resultingHomeTeamId = payload.homeTeamId ?? existing.homeTeamId;
    const resultingAwayTeamId = payload.awayTeamId ?? existing.awayTeamId;
    if (resultingHomeTeamId === resultingAwayTeamId) {
        return {
            outcome: "rejected",
            problem: businessRuleValidationError("home_team_id and away_team_id must differ (CK)", instance),
        };
    }
    const updatedRow = {
        ...existing,
        homeTeamId: resultingHomeTeamId,
        awayTeamId: resultingAwayTeamId,
        format: payload.format ?? existing.format,
        oversAllotted: payload.oversAllotted !== undefined ? payload.oversAllotted : existing.oversAllotted,
        homeXi: payload.homeXi !== undefined ? payload.homeXi : existing.homeXi,
        awayXi: payload.awayXi !== undefined ? payload.awayXi : existing.awayXi,
        conditionsProfile: payload.conditionsProfile !== undefined ? payload.conditionsProfile : existing.conditionsProfile,
        conditionsProfileVersion: payload.conditionsProfileVersion !== undefined ? payload.conditionsProfileVersion : existing.conditionsProfileVersion,
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
export class InMemoryMatchStore {
    rows = new Map();
    get(id) {
        return this.rows.get(id) ?? null;
    }
    insert(row) {
        this.rows.set(row.id, row);
    }
    update(row) {
        this.rows.set(row.id, row);
    }
}
//# sourceMappingURL=matches.js.map