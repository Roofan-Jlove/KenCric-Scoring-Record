/**
 * TASK-0100: generic CRUD for `reference_data`
 * (`data-specification.md §5.4`, `api-specification.md §4/§5/§10`).
 *
 * This is the real table backing `api-specification.md §10.2`'s
 * "Condition templates" row (`kind=CONDITIONS_PROFILE`) and,
 * incidentally, its two sibling kinds (`DLS_TABLE`, `APP_CONFIG`) the
 * same shared table also holds -- built faithfully rather than
 * artificially narrowed to one `kind`.
 *
 * Two genuine spec tensions, flagged rather than silently resolved:
 *
 * 1. `§10.2`'s own path is `/organizations/{orgId}/condition-
 *    templates` -- a nested, org-scoped URL -- but `§5.4`'s own field
 *    table has NO `organization_id` column at all; `reference_data`
 *    is genuinely global (PK `(kind, version)`, no org scoping). No
 *    `organizationId` field is invented here to match the URL.
 *
 * 2. `§10.2` says publishing is "platform/org-admin only"; `§5.4`'s
 *    own field-level note restricts `published_by` to platform-admin
 *    specifically. This module accepts any `publishedBy` actor
 *    reference without a role check, consistent with `FA-7` (the real
 *    authorization boundary is RLS, not this command layer).
 *
 * `publishReferenceData` is the ONLY write operation -- `§5.4`'s own
 * text: "a published (kind, version) row is never updated in place --
 * a change is a new version." `§10.2`'s own text is explicit that a
 * `PUT` against an already-published `(kind, version)` is
 * unconditionally `409`, "not a silent overwrite" -- no idempotency
 * exception even for a byte-identical resubmission, unlike `§8.3`'s
 * general PUT-idempotency framing every other resource here relies on.
 *
 * `DELETE` does not exist at all -- `§5.4`'s own Soft-deletion line:
 * "none -- every historical version must remain resolvable for as
 * long as any match still pins it." The strongest exclusion in this
 * backlog (stronger than "undefined policy," stronger than "owned by
 * a future command" -- this is never, by design).
 */
import { businessRuleValidationError, invalidTransitionError, notFoundError, schemaValidationError } from "./errors.js";
export const VALID_REFERENCE_DATA_KINDS = ["CONDITIONS_PROFILE", "DLS_TABLE", "APP_CONFIG"];
/**
 * The only write operation this resource has. `version` must be
 * exactly `currentHighest + 1` for its `kind` -- an already-existing
 * version is `409` ("not a silent overwrite," no idempotency
 * exception); a version that skips ahead of the monotonic sequence is
 * `422`.
 */
export function publishReferenceData(payload, store, nowIso, instance) {
    if (!payload.kind || !VALID_REFERENCE_DATA_KINDS.includes(payload.kind)) {
        return {
            outcome: "rejected",
            problem: schemaValidationError(`kind must be one of ${VALID_REFERENCE_DATA_KINDS.join(", ")}`, instance),
        };
    }
    if (payload.version === undefined || payload.version === null) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: version", instance) };
    }
    if (payload.payload === undefined || payload.payload === null) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: payload", instance) };
    }
    if (!payload.publishedBy) {
        return { outcome: "rejected", problem: schemaValidationError("Missing required field: publishedBy", instance) };
    }
    const kind = payload.kind;
    if (store.get(kind, payload.version)) {
        return {
            outcome: "rejected",
            problem: invalidTransitionError(`${kind} version ${payload.version} is already published -- a change is always a new version, never an overwrite`, instance),
        };
    }
    const existingVersions = store.listByKind(kind).map((r) => r.version);
    const currentHighest = existingVersions.length > 0 ? Math.max(...existingVersions) : 0;
    const expectedNext = currentHighest + 1;
    if (payload.version !== expectedNext) {
        return {
            outcome: "rejected",
            problem: businessRuleValidationError(`version must be exactly ${expectedNext} (the next version after the current highest, ${currentHighest}) -- got ${payload.version}`, instance),
        };
    }
    const row = {
        kind,
        version: payload.version,
        payload: payload.payload,
        publishedAt: nowIso,
        publishedBy: payload.publishedBy,
    };
    store.insert(row);
    return { outcome: "published", row };
}
export function getReferenceData(kind, version, store, instance) {
    const row = store.get(kind, version);
    if (!row) {
        return { outcome: "rejected", problem: notFoundError(`No reference data visible for kind ${kind}, version ${version}`, instance) };
    }
    return { outcome: "found", row };
}
/** `GET /condition-templates` (conceptually, for `kind=CONDITIONS_PROFILE`).
 * Every version for one `kind`, oldest first. */
export function listReferenceData(kind, store) {
    return store.listByKind(kind).slice().sort((a, b) => a.version - b.version);
}
/** `§5.4`'s own `IX: kind` note states its purpose explicitly: "to
 * fetch the latest quickly." The highest-version row for a `kind`. */
export function getLatestReferenceData(kind, store, instance) {
    const rows = store.listByKind(kind);
    if (rows.length === 0) {
        return { outcome: "rejected", problem: notFoundError(`No reference data has ever been published for kind ${kind}`, instance) };
    }
    const latest = rows.reduce((highest, row) => (row.version > highest.version ? row : highest));
    return { outcome: "found", row: latest };
}
function compositeKey(kind, version) {
    return `${kind}::${version}`;
}
/** An in-memory ReferenceDataStore for tests -- not a production adapter. */
export class InMemoryReferenceDataStore {
    rows = new Map();
    get(kind, version) {
        return this.rows.get(compositeKey(kind, version)) ?? null;
    }
    insert(row) {
        this.rows.set(compositeKey(row.kind, row.version), row);
    }
    listByKind(kind) {
        return Array.from(this.rows.values()).filter((r) => r.kind === kind);
    }
}
//# sourceMappingURL=referenceData.js.map