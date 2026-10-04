/**
 * TASK-0146: `audit_log` (`data-specification.md §10.1`) -- picked
 * after `TASK-0145` as the next real, bounded gap: three already-built
 * commands each explicitly flag, in their own doc comments, that their
 * `audit_log` write was deliberately left unwired --
 * `disputeMatch.ts`/`mergePlayers.ts`/`organizationLifecycle.ts`. This
 * module is the storage + hash-chain layer those three now compose
 * into; it is not itself a new endpoint (`§10.1`'s own Sync model line
 * says this table is "server-only," written only as a side effect of
 * another action, never directly by a device or a standalone command).
 *
 * **A real, pre-existing gap found and worked around, not silently
 * invented past:** `system-architecture.md §4.6`/`ADR-08` both reference
 * "a documented deterministic serialisation... used for `hash`
 * computation" for this exact table -- but no document anywhere in this
 * corpus ever actually writes that serialisation down. This is the same
 * already-flagged gap `TASK-0035`/`TASK-0142` found for `match_events`'
 * own hash field, now hit a second time for a different table.
 * `computeAuditLogHash` below IS a real cryptographic hash (Node's
 * built-in SHA-256, not a placeholder algorithm) -- what's actually
 * invented here is only the canonical field order/serialisation fed
 * into it, a stand-in convention pending a real spec, flagged the same
 * way `ApiErrors.kt`'s `ERROR_BASE_URI` placeholder already is.
 * Revisit this function specifically if a real canonicalisation
 * document is ever written -- every already-chained row would need
 * re-hashing under the new scheme, a real migration concern for later.
 *
 * **`reason` is "required by application logic" for `category =
 * OVERRIDE/ADMIN/DISPUTE/PLAYER_MERGE`, per `§10.1`'s own field note,
 * "though not DB-enforced... since the requirement is
 * category-conditional."** Enforced here, at the one real write path,
 * as a thrown error on a missing reason for one of those four
 * categories -- an internal invariant violation by the composing
 * command, not a user-facing rejection (every composing call site below
 * already has a non-empty reason by the time it reaches this far; the
 * one exception, `reactivateOrganization`, has no user-supplied reason
 * field at all, so it supplies a fixed, non-invented string -- see that
 * module's own call site).
 */

import { createHash } from "node:crypto";

export type AuditLogCategory = "AUTH" | "MEMBERSHIP" | "IMPERSONATION" | "OVERRIDE" | "EXPORT" | "SHARE_LINK" | "ADMIN" | "RETENTION" | "DISPUTE" | "PLAYER_MERGE";

const REASON_REQUIRED_CATEGORIES: readonly AuditLogCategory[] = ["OVERRIDE", "ADMIN", "DISPUTE", "PLAYER_MERGE"];

export interface AuditLogRow {
  id: string;
  category: AuditLogCategory;
  actorRef: string;
  impersonatedActorRef: string | null;
  targetRef: string | null;
  action: string;
  detail: Record<string, unknown>;
  reason: string | null;
  prevHash: string | null;
  hash: string;
  createdAt: string;
}

export interface AuditLogStore {
  /** The chain head -- the `hash` of the most recently inserted row, or `null` if the table is empty. */
  getLastHash(): string | null;
  insert(row: AuditLogRow): void;
  list(): AuditLogRow[];
}

/**
 * The shape every composing command's own new optional trailing
 * parameter takes -- pairs a store with the one new row's id, since the
 * two are never meaningful apart (an id with no store to write to, or a
 * store with no id for the caller to have pre-generated, are both
 * nonsensical). `newId` generation itself is delegated to the caller,
 * the same convention every other `insert`-shaped command in this
 * backlog already uses (e.g. `lockMatchForDispute`'s own `newDisputeId`).
 */
export interface AuditLogWrite {
  store: AuditLogStore;
  newId: string;
}

/**
 * See this module's own doc comment for the honest caveat: SHA-256
 * itself is real, the field order fed into it is this task's own
 * stand-in convention, not a ratified spec.
 */
export function computeAuditLogHash(
  prevHash: string | null,
  category: AuditLogCategory,
  actorRef: string,
  impersonatedActorRef: string | null,
  targetRef: string | null,
  action: string,
  detail: Record<string, unknown>,
  reason: string | null,
  createdAt: string,
): string {
  const canonical = JSON.stringify({ prevHash, category, actorRef, impersonatedActorRef, targetRef, action, detail, reason, createdAt });
  return createHash("sha256").update(canonical).digest("hex");
}

export interface WriteAuditLogEntryInput {
  id: string;
  category: AuditLogCategory;
  actorRef: string;
  impersonatedActorRef?: string | null;
  targetRef?: string | null;
  action: string;
  detail: Record<string, unknown>;
  reason?: string | null;
}

/**
 * The one real write path onto `audit_log`. Always succeeds or throws
 * -- there is no rejectable request shape here, matching `§10.1`'s own
 * "a device never writes this table directly" framing: by the time a
 * composing command calls this, its own request has already been
 * fully validated.
 */
export function writeAuditLogEntry(input: WriteAuditLogEntryInput, store: AuditLogStore, nowIso: string): AuditLogRow {
  const reason = input.reason ?? null;
  if (REASON_REQUIRED_CATEGORIES.includes(input.category) && !reason) {
    throw new Error(`audit_log category ${input.category} requires a reason, none was supplied (action: ${input.action})`);
  }

  const impersonatedActorRef = input.impersonatedActorRef ?? null;
  const targetRef = input.targetRef ?? null;
  const prevHash = store.getLastHash();
  const hash = computeAuditLogHash(prevHash, input.category, input.actorRef, impersonatedActorRef, targetRef, input.action, input.detail, reason, nowIso);

  const row: AuditLogRow = {
    id: input.id,
    category: input.category,
    actorRef: input.actorRef,
    impersonatedActorRef,
    targetRef,
    action: input.action,
    detail: input.detail,
    reason,
    prevHash,
    hash,
    createdAt: nowIso,
  };
  store.insert(row);
  return row;
}

/** An in-memory AuditLogStore for tests -- not a production adapter. */
export class InMemoryAuditLogStore implements AuditLogStore {
  private readonly rows: AuditLogRow[] = [];

  getLastHash(): string | null {
    return this.rows.length > 0 ? this.rows[this.rows.length - 1].hash : null;
  }

  insert(row: AuditLogRow): void {
    this.rows.push(row);
  }

  list(): AuditLogRow[] {
    return [...this.rows];
  }
}
