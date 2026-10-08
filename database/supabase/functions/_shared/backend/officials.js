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
import { businessRuleValidationError, notFoundError, schemaValidationError, staleVersionError } from "./errors.js";
const REQUIRED_FIELDS = ["id", "name"];
/** §4.1 schema layer: field presence -- runs before any domain logic. 400 on failure. */
export function validateOfficialSchema(payload, instance) {
    for (const field of REQUIRED_FIELDS) {
        const value = payload[field];
        if (value === undefined || value === null || value === "") {
            return schemaValidationError(`Missing required field: ${field}`, instance);
        }
    }
    return null;
}
/** The create half of `PUT /officials/{id}`. */
export function createOfficial(payload, store, actorRef, nowIso, instance) {
    const schemaProblem = validateOfficialSchema(payload, instance);
    if (schemaProblem)
        return { outcome: "rejected", problem: schemaProblem };
    const validated = payload;
    if (store.get(validated.id)) {
        return {
            outcome: "rejected",
            problem: schemaValidationError(`An official with id ${validated.id} already exists -- use the update path, not create`, instance),
        };
    }
    const row = {
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
/** The update half of `PUT /officials/{id}`. Only fields present in
 * [payload] are changed (`undefined` = "leave unchanged"). */
export function updateOfficial(id, payload, store, actorRef, nowIso, instance) {
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
    const updatedRow = {
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
export function getOfficial(id, store, instance) {
    const row = store.get(id);
    if (!row) {
        return { outcome: "rejected", problem: notFoundError(`No official visible with id ${id}`, instance) };
    }
    return { outcome: "found", row };
}
/** §6's own defaults: `[DEFAULT] 50`, `[DEFAULT] max 200`. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/** `GET /officials`. Keyset-paginated by `id` ascending (§6);
 * `organizationId` is the real filterable field for this resource --
 * see this module's own doc comment for why `matchId` is not. */
export function listOfficials(query, store) {
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
/**
 * `DELETE /officials/{id}`. `data-specification.md §5.2`'s own
 * policy, exactly: a never-assigned official may be hard-deleted; one
 * with any match assignment is refused (`422`), never a silent
 * no-op. No authorship restriction -- the spec names none for this
 * resource, unlike `teams`'.
 */
export function deleteOfficial(id, store, instance) {
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
export class InMemoryOfficialStore {
    rows = new Map();
    assignedOfficialIds = new Set();
    get(id) {
        return this.rows.get(id) ?? null;
    }
    insert(row) {
        this.rows.set(row.id, row);
    }
    update(row) {
        this.rows.set(row.id, row);
    }
    remove(id) {
        this.rows.delete(id);
    }
    list() {
        return Array.from(this.rows.values());
    }
    hasMatchAssignment(id) {
        return this.assignedOfficialIds.has(id);
    }
    /** Test-only helper -- marks an official as having a match
     * assignment, so both `deleteOfficial` branches are exercisable
     * without a real `match_officials` join. */
    markHasMatchAssignment(id) {
        this.assignedOfficialIds.add(id);
    }
}
//# sourceMappingURL=officials.js.map