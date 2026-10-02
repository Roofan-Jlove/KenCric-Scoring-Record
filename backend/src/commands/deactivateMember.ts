/**
 * TASK-0101: `POST /organizations/{orgId}/memberships/{membershipId}/deactivate`
 * (`api-specification.md §11.3`) -- the first `§11` match-lifecycle
 * command in this backlog, not generic CRUD.
 *
 * `§11.3`'s own Request shape is literally `{}` -- no `row_version` at
 * all. Per `§8.3`, command/RPC endpoints use the Idempotency-Key
 * mechanism (`§8.1`/`§8.2`) instead of the `row_version` optimistic-
 * concurrency check every `§6.1` resource relied on. Implemented per
 * `§8.2`'s own precise behavior: a key that already produced a
 * SUCCESSFUL result returns that identical prior result, never
 * recomputed; a key that previously failed is processed fresh next
 * time, never cached ("a failed attempt never 'poisons' the key").
 *
 * `§11.3`'s own Trace line cites `FR-009, BR-024` -- but SRS `BR-024`
 * is "Toss determines initial innings order," wholly unrelated. The
 * real SRS entry is `BR-023` ("Deactivated-member authorship
 * retained"), which traces to discovery `BR-024`+`BR-025`
 * (consolidated) -- `§11.3` cited the discovery-level number
 * directly, and that same number independently collides with an
 * unrelated SRS entry. `BR-023` is the real citation.
 *
 * `Authz: Org-admin` is deliberately not enforced here, per `FA-7` --
 * RLS is the real authorization boundary, not this command layer.
 */

import { notFoundError, type ProblemDetails } from "../authz/errors.js";
import type { MembershipRow, MembershipStore } from "./memberships.js";

export type DeactivateMemberResult =
  | { outcome: "deactivated"; row: MembershipRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/**
 * Per-endpoint idempotency-key cache (`§8.1`/`§8.2`). A real adapter
 * backs this with a shared `idempotency_keys` table scoped by
 * (endpoint, key); this module's own store is already scoped to this
 * one endpoint. `§8.1`'s own `[DEFAULT]` 24-hour retention window is
 * not modeled here -- the in-memory test double retains keys
 * indefinitely, the same simplification every other in-memory store
 * in this backlog already makes about real persistence.
 */
export interface IdempotencyStore {
  getPriorSuccess(key: string): DeactivateMemberResult | null;
  recordSuccess(key: string, result: DeactivateMemberResult): void;
}

/**
 * Sets a membership's `status` to `DEACTIVATED` -- never via the
 * generic `PUT` (`TASK-0095`'s own established exclusion). Idempotent
 * via `idempotencyKey`, not `row_version`.
 */
export function deactivateMember(
  membershipId: string,
  idempotencyKey: string,
  membershipStore: MembershipStore,
  idempotencyStore: IdempotencyStore,
  actorRef: string,
  nowIso: string,
  instance: string,
): DeactivateMemberResult {
  const priorResult = idempotencyStore.getPriorSuccess(idempotencyKey);
  if (priorResult) {
    return priorResult;
  }

  const existing = membershipStore.get(membershipId);
  if (!existing) {
    // Not cached against the key -- §8.2: a failed attempt never
    // "poisons" the key, so a retry with the same key is reprocessed
    // fresh, not replayed as this same 404.
    return { outcome: "rejected", problem: notFoundError(`No membership visible with id ${membershipId}`, instance) };
  }

  if (existing.status === "DEACTIVATED") {
    // Already in the target state -- a safe no-op, not an error. No
    // spec text says a second deactivation should fail, and the
    // resulting state is identical either way.
    const result: DeactivateMemberResult = { outcome: "deactivated", row: existing };
    idempotencyStore.recordSuccess(idempotencyKey, result);
    return result;
  }

  const updatedRow: MembershipRow = {
    ...existing,
    status: "DEACTIVATED",
    rowVersion: existing.rowVersion + 1,
    updatedAt: nowIso,
    updatedBy: actorRef,
  };

  membershipStore.update(updatedRow);

  const result: DeactivateMemberResult = { outcome: "deactivated", row: updatedRow };
  idempotencyStore.recordSuccess(idempotencyKey, result);
  return result;
}

/** An in-memory IdempotencyStore for tests -- not a production adapter. */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly successesByKey = new Map<string, DeactivateMemberResult>();

  getPriorSuccess(key: string): DeactivateMemberResult | null {
    return this.successesByKey.get(key) ?? null;
  }

  recordSuccess(key: string, result: DeactivateMemberResult): void {
    this.successesByKey.set(key, result);
  }
}
