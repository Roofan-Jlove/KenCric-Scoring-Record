/**
 * TASK-0093: generic CRUD for `organizations`
 * (`data-specification.md §3.2`, `api-specification.md §4/§5/§6/§7/§10`).
 *
 * Mirrors `matches.ts`'s own structure (`TASK-0039`/`TASK-0044`)
 * directly -- same error constructors, same schema/state-dependent
 * layering, same `PUT` create-or-update semantics with a client-
 * supplied id. Bundled into one task (create+update+list+get-one)
 * rather than split like `matches` was, because `organizations` has no
 * request-shape deviations from storage and no business-rule layer at
 * all (`api-specification.md §10.2`'s own table says so) -- see this
 * task's own backlog mint note for the full reasoning.
 *
 * `DELETE /organizations/{id}` is deliberately NOT implemented here --
 * `data-specification.md §3.2` states outright that soft-deletion is
 * "not defined in this iteration" for this table (open item `DSQ-2`),
 * and `api-specification.md §10.1`'s `DELETE` contract requires
 * following that resource's own policy exactly. There is no policy to
 * follow yet; inventing one would be exactly the false assumption
 * `ai-context-pack.md FA-9` warns against.
 */
import { notFoundError, schemaValidationError, staleVersionError } from "./errors.js";
const REQUIRED_FIELDS = ["id", "name"];
/** §4.1 schema layer: field presence -- runs before any domain logic. 400 on failure. */
export function validateOrganizationSchema(payload, instance) {
    for (const field of REQUIRED_FIELDS) {
        const value = payload[field];
        if (value === undefined || value === null || value === "") {
            return schemaValidationError(`Missing required field: ${field}`, instance);
        }
    }
    return null;
}
/** The create half of `PUT /organizations/{id}`. */
export function createOrganization(payload, store, actorRef, nowIso, instance) {
    const schemaProblem = validateOrganizationSchema(payload, instance);
    if (schemaProblem)
        return { outcome: "rejected", problem: schemaProblem };
    const validated = payload;
    if (store.get(validated.id)) {
        // §10.1: PUT is create-or-update by client-supplied id. An
        // existing id means this call is actually an update.
        return {
            outcome: "rejected",
            problem: schemaValidationError(`An organization with id ${validated.id} already exists -- use the update path, not create`, instance),
        };
    }
    const row = {
        id: validated.id,
        name: validated.name,
        branding: validated.branding ?? null,
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
/** The update half of `PUT /organizations/{id}`. Only fields present in
 * [payload] are changed (`undefined` = "leave unchanged"). */
export function updateOrganization(id, payload, store, actorRef, nowIso, instance) {
    const existing = store.get(id);
    if (!existing) {
        // §5.2's own registry: identical response whether the resource
        // truly doesn't exist or RLS merely hides it -- never distinguish.
        return { outcome: "rejected", problem: notFoundError(`No organization visible with id ${id}`, instance) };
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
        // `name` is NOT NULL in storage (§3.2) -- a present-but-empty
        // update would violate that constraint were it applied.
        return { outcome: "rejected", problem: schemaValidationError("name must not be empty", instance) };
    }
    const updatedRow = {
        ...existing,
        name: payload.name ?? existing.name,
        branding: payload.branding !== undefined ? payload.branding : existing.branding,
        rowVersion: existing.rowVersion + 1,
        updatedAt: nowIso,
        updatedBy: actorRef,
    };
    store.update(updatedRow);
    return { outcome: "updated", row: updatedRow };
}
export function getOrganization(id, store, instance) {
    const row = store.get(id);
    if (!row) {
        return { outcome: "rejected", problem: notFoundError(`No organization visible with id ${id}`, instance) };
    }
    return { outcome: "found", row };
}
/** §6's own defaults: `[DEFAULT] 50`, `[DEFAULT] max 200`. */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
/**
 * `GET /organizations`. Keyset-paginated by `id` ascending (§6); `after`
 * is the last-seen `id`, never an offset. `nameSearch` is this task's
 * own addition -- `§6`'s "Filterable fields" sentence omits
 * `organizations` entirely, but `§3.2`'s own trigram index on `name`
 * ("for admin search") is the same shape `teams`/`players` already use
 * to support their own `name_search` filter; flagged as filling a spec
 * omission, not inventing a new capability from nothing.
 */
export function listOrganizations(query, store) {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    let rows = store.list().slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
/** An in-memory OrganizationStore for tests -- not a production adapter. */
export class InMemoryOrganizationStore {
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
    list() {
        return Array.from(this.rows.values());
    }
}
//# sourceMappingURL=organizations.js.map