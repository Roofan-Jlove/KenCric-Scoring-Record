/**
 * TASK-0099: generic CRUD for `match_officials`
 * (`data-specification.md §5.3`, `api-specification.md §4/§5/§10`).
 *
 * `data-specification.md §5.3`'s own PK is the three-part composite
 * `(match_id, official_id, role)` -- `api-specification.md §10.2`'s
 * own deviation note only names `{officialId}` in the URL
 * (`/matches/{matchId}/officials/{officialId}`), leaving `role` with
 * no stated place in the URL at all. Since `role` is genuinely part
 * of the identifying key (the schema allows the same official to hold
 * two different roles on the same match as two distinct rows), every
 * operation here is keyed by the FULL triple -- `role` is a required
 * field the caller always supplies alongside `officialId`, not an
 * assumption that one official holds at most one role per match.
 *
 * There is no update operation at all: `created_at`/`created_by` are
 * the only non-key fields, so once a triple exists there is nothing
 * left to mutate. "Reassignment is a remove+add" (the table's own
 * words) isn't a design choice this module works around -- it's the
 * only possible way to change a role, since `role` is part of the key.
 *
 * `addMatchOfficial` enforces exactly one business rule:
 * `domain-model.md`'s own `OFCL-003` ("exactly one HEAD [scorer]") --
 * a maximum-count constraint checkable incrementally. `OFCL-001/011`'s
 * minimum-count rules ("≥ 1 on-field umpire, 2 for ICC profiles"; "≥ 1
 * scorer") are deliberately NOT enforced here -- they are panel-
 * readiness gates checkable only once a roster is assembled (checking
 * per-add would make it impossible to ever add the first official),
 * and the "2 for ICC profiles" clause depends on a playing-conditions
 * profile this layer has no visibility into.
 */
import { businessRuleValidationError, notFoundError, schemaValidationError } from "./errors.js";
/**
 * `data-specification.md §5.3`'s own five values. `domain-model.md`'s
 * `VO-MATCH-OFFICIALS` separately names a `fourthUmpire?` slot with no
 * corresponding table-level role -- a real schema-vs-domain-model
 * mismatch, flagged in this module's own doc comment and left
 * unresolved (fixing the schema is out of this task's scope); this
 * list validates against exactly what the table itself defines.
 */
export const VALID_MATCH_OFFICIAL_ROLES = ["UMPIRE", "THIRD_UMPIRE", "REFEREE", "HEAD_SCORER", "ASSISTANT_SCORER"];
/**
 * `PUT /matches/{matchId}/officials/{officialId}` (`role` supplied
 * alongside). Idempotent upsert of the exact triple -- never a `409`
 * (no `row_version` exists); rejected only if this would create a
 * second `HEAD_SCORER` on the same match (`OFCL-003`).
 */
export function addMatchOfficial(matchId, officialId, role, store, actorRef, nowIso, instance) {
    if (!matchId)
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: matchId", instance) };
    if (!officialId)
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: officialId", instance) };
    if (!VALID_MATCH_OFFICIAL_ROLES.includes(role)) {
        return {
            outcome: "rejected",
            problem: schemaValidationError(`role must be one of ${VALID_MATCH_OFFICIAL_ROLES.join(", ")}`, instance),
        };
    }
    const existing = store.get(matchId, officialId, role);
    if (!existing && role === "HEAD_SCORER") {
        const alreadyHasHead = store.listByMatch(matchId).some((row) => row.role === "HEAD_SCORER");
        if (alreadyHasHead) {
            return {
                outcome: "rejected",
                problem: businessRuleValidationError("A match may have exactly one HEAD_SCORER (OFCL-003)", instance),
            };
        }
    }
    const row = existing ?? {
        matchId,
        officialId,
        role: role,
        createdAt: nowIso,
        createdBy: actorRef,
    };
    store.upsert(row);
    return { outcome: "added", row };
}
export function getMatchOfficial(matchId, officialId, role, store, instance) {
    const row = store.get(matchId, officialId, role);
    if (!row) {
        return {
            outcome: "rejected",
            problem: notFoundError(`No match official visible for match ${matchId}, official ${officialId}, role ${role}`, instance),
        };
    }
    return { outcome: "found", row };
}
/** `GET /matches/{matchId}/officials`. A match's officiating panel is
 * small by nature -- no keyset-pagination envelope, the same
 * deliberate simplification `squad_members` already established. */
export function listMatchOfficials(matchId, store) {
    return store.listByMatch(matchId);
}
/** `DELETE /matches/{matchId}/officials/{officialId}` (`role`
 * supplied alongside). Plain hard delete -- no gate; `§5.3`'s own
 * text says the official's historical involvement remains visible via
 * the read-model card lines' provenance regardless of this row. */
export function removeMatchOfficial(matchId, officialId, role, store, instance) {
    const existing = store.get(matchId, officialId, role);
    if (!existing) {
        return {
            outcome: "rejected",
            problem: notFoundError(`No match official visible for match ${matchId}, official ${officialId}, role ${role}`, instance),
        };
    }
    store.remove(matchId, officialId, role);
    return { outcome: "removed" };
}
function compositeKey(matchId, officialId, role) {
    return `${matchId}::${officialId}::${role}`;
}
/** An in-memory MatchOfficialStore for tests -- not a production adapter. */
export class InMemoryMatchOfficialStore {
    rows = new Map();
    get(matchId, officialId, role) {
        return this.rows.get(compositeKey(matchId, officialId, role)) ?? null;
    }
    upsert(row) {
        this.rows.set(compositeKey(row.matchId, row.officialId, row.role), row);
    }
    remove(matchId, officialId, role) {
        this.rows.delete(compositeKey(matchId, officialId, role));
    }
    listByMatch(matchId) {
        return Array.from(this.rows.values()).filter((r) => r.matchId === matchId);
    }
}
//# sourceMappingURL=matchOfficials.js.map