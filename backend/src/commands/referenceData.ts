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

import { businessRuleValidationError, invalidTransitionError, notFoundError, schemaValidationError, type ProblemDetails } from "../authz/errors.js";

export const VALID_REFERENCE_DATA_KINDS = ["CONDITIONS_PROFILE", "DLS_TABLE", "APP_CONFIG"] as const;

export type ReferenceDataKind = (typeof VALID_REFERENCE_DATA_KINDS)[number];

export interface ReferenceDataRow {
  kind: ReferenceDataKind;
  version: number;
  payload: unknown;
  publishedAt: string;
  publishedBy: string;
}

export interface ReferenceDataStore {
  get(kind: string, version: number): ReferenceDataRow | null;
  insert(row: ReferenceDataRow): void;
  listByKind(kind: string): ReferenceDataRow[];
}

export interface PublishReferenceDataPayload {
  kind: string;
  version: number;
  payload: unknown;
  publishedBy: string;
}

export type PublishReferenceDataResult =
  | { outcome: "published"; row: ReferenceDataRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * The only write operation this resource has. `version` must be
 * exactly `currentHighest + 1` for its `kind` -- an already-existing
 * version is `409` ("not a silent overwrite," no idempotency
 * exception); a version that skips ahead of the monotonic sequence is
 * `422`.
 */
export function publishReferenceData(
  payload: Partial<PublishReferenceDataPayload>,
  store: ReferenceDataStore,
  nowIso: string,
  instance: string,
): PublishReferenceDataResult {
  if (!payload.kind || !(VALID_REFERENCE_DATA_KINDS as readonly string[]).includes(payload.kind)) {
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

  const kind = payload.kind as ReferenceDataKind;

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
      problem: businessRuleValidationError(
        `version must be exactly ${expectedNext} (the next version after the current highest, ${currentHighest}) -- got ${payload.version}`,
        instance,
      ),
    };
  }

  const row: ReferenceDataRow = {
    kind,
    version: payload.version,
    payload: payload.payload,
    publishedAt: nowIso,
    publishedBy: payload.publishedBy,
  };

  store.insert(row);
  return { outcome: "published", row };
}

export type GetReferenceDataResult =
  | { outcome: "found"; row: ReferenceDataRow }
  | { outcome: "rejected"; problem: ProblemDetails };

export function getReferenceData(kind: string, version: number, store: ReferenceDataStore, instance: string): GetReferenceDataResult {
  const row = store.get(kind, version);
  if (!row) {
    return { outcome: "rejected", problem: notFoundError(`No reference data visible for kind ${kind}, version ${version}`, instance) };
  }
  return { outcome: "found", row };
}

/** `GET /condition-templates` (conceptually, for `kind=CONDITIONS_PROFILE`).
 * Every version for one `kind`, oldest first. */
export function listReferenceData(kind: string, store: ReferenceDataStore): ReferenceDataRow[] {
  return store.listByKind(kind).slice().sort((a, b) => a.version - b.version);
}

export type GetLatestReferenceDataResult =
  | { outcome: "found"; row: ReferenceDataRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `§5.4`'s own `IX: kind` note states its purpose explicitly: "to
 * fetch the latest quickly." The highest-version row for a `kind`. */
export function getLatestReferenceData(kind: string, store: ReferenceDataStore, instance: string): GetLatestReferenceDataResult {
  const rows = store.listByKind(kind);
  if (rows.length === 0) {
    return { outcome: "rejected", problem: notFoundError(`No reference data has ever been published for kind ${kind}`, instance) };
  }
  const latest = rows.reduce((highest, row) => (row.version > highest.version ? row : highest));
  return { outcome: "found", row: latest };
}

function compositeKey(kind: string, version: number): string {
  return `${kind}::${version}`;
}

/** An in-memory ReferenceDataStore for tests -- not a production adapter. */
export class InMemoryReferenceDataStore implements ReferenceDataStore {
  private readonly rows = new Map<string, ReferenceDataRow>();

  get(kind: string, version: number): ReferenceDataRow | null {
    return this.rows.get(compositeKey(kind, version)) ?? null;
  }

  insert(row: ReferenceDataRow): void {
    this.rows.set(compositeKey(row.kind, row.version), row);
  }

  listByKind(kind: string): ReferenceDataRow[] {
    return Array.from(this.rows.values()).filter((r) => r.kind === kind);
  }
}
