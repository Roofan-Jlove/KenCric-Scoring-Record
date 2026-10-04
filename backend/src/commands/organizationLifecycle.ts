/**
 * TASK-0133: `CMD-SUSPEND-ORGANIZATION` / `CMD-DELETE-ORGANIZATION`
 * (`domain-model.md`) -- the seventh task pulled from `§6.3`'s
 * deferred list, and the one tenant-management piece this round
 * actually resolves `§13`'s own flagged open item `DSQ-2` to build,
 * per the user's own explicit direction (asked whether to resolve the
 * open question or leave it deferred; the user said resolve it).
 *
 * **No `api-specification.md` endpoint exists for this pair either**
 * (the same "no written contract, synthesize from the domain model"
 * shape `divergenceResolution.ts` already used) -- the contract below
 * is built directly from `domain-model.md`'s own `ENT-ORGANIZATION`
 * Lifecycle and `organizations.ts`'s own newly-widened `status` field
 * (`TASK-0133`'s own schema half, see that module's own doc comment).
 *
 * **A real citation correction, the twelfth instance of this session's
 * own discovery-vs-SRS shape, carried over from the schema RCR:**
 * `domain-model.md`'s own citation for this Lifecycle is `BR-025` --
 * SRS's own `BR-025` is "Bowler over rules," wholly unrelated; the
 * real entry is `BR-023` ("Deactivated-member authorship retained"),
 * the same consolidated discovery `BR-024`+`BR-025` target this
 * session already found mis-cited twice before (`TASK-0101`,
 * `TASK-0104`), now a third independent hit on the identical pair.
 *
 * **`SUSPENDED` is reversible (`↔`), `DELETED` is terminal (`→`,
 * one-way)** -- mirrors `domain-model.md`'s own arrow notation
 * exactly: `reactivateOrganization` only accepts a `SUSPENDED` row;
 * there is no `undeleteOrganization` at all.
 *
 * **A real scope boundary, flagged rather than silently assumed:**
 * this module does NOT cascade suspension/deletion onto an org's own
 * `memberships`/`teams`/`matches` rows (e.g. blocking scoring on a
 * suspended org's matches) -- `§3.2`'s own Soft-deletion note says
 * explicitly "no cascading deactivation is modelled here," a future
 * task's own decision, not invented by this one.
 *
 * **`audit_log`'s own `category = ADMIN` entry for these three actions
 * is now wired, by `TASK-0146`** -- all three functions take a new
 * optional trailing `auditLog` parameter; on success only, a row is
 * written with `action` `"SUSPEND"`/`"REACTIVATE"`/`"DELETE"`. `ADMIN`
 * requires a `reason` per `§10.1`'s own field note -- `suspend`/`delete`
 * already have one (a required request field on each); `reactivate` has
 * none at all in its own request shape, so it supplies a fixed,
 * non-invented string (`"Organization reactivated"`) rather than
 * fabricating a user-facing reason field this endpoint's own contract
 * never asked for.
 */

import { invalidTransitionError, notFoundError, schemaValidationError, type ProblemDetails } from "../authz/errors.js";
import type { OrganizationRow, OrganizationStore } from "./organizations.js";
import { writeAuditLogEntry, type AuditLogWrite } from "./auditLog.js";

export type SuspendOrganizationResult =
  | { outcome: "suspended"; row: OrganizationRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `POST /organizations/{orgId}/suspend`. Only an `ACTIVE` org may be suspended. */
export function suspendOrganization(
  orgId: string,
  reason: string | undefined,
  actorRef: string,
  store: OrganizationStore,
  nowIso: string,
  instance: string,
  auditLog?: AuditLogWrite,
): SuspendOrganizationResult {
  if (!reason) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: reason", instance) };
  }

  const existing = store.get(orgId);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No organization visible with id ${orgId}`, instance) };
  }

  if (existing.status !== "ACTIVE") {
    return { outcome: "rejected", problem: invalidTransitionError(`Organization ${orgId} is ${existing.status}, not ACTIVE -- cannot suspend`, instance) };
  }

  const updated: OrganizationRow = { ...existing, status: "SUSPENDED", rowVersion: existing.rowVersion + 1, updatedAt: nowIso, updatedBy: actorRef };
  store.update(updated);

  if (auditLog) {
    writeAuditLogEntry({ id: auditLog.newId, category: "ADMIN", actorRef, targetRef: orgId, action: "SUSPEND", detail: {}, reason }, auditLog.store, nowIso);
  }

  return { outcome: "suspended", row: updated };
}

export type ReactivateOrganizationResult =
  | { outcome: "reactivated"; row: OrganizationRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `POST /organizations/{orgId}/reactivate`. Only a `SUSPENDED` org may be reactivated -- `DELETED` is terminal. */
export function reactivateOrganization(
  orgId: string,
  actorRef: string,
  store: OrganizationStore,
  nowIso: string,
  instance: string,
  auditLog?: AuditLogWrite,
): ReactivateOrganizationResult {
  const existing = store.get(orgId);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No organization visible with id ${orgId}`, instance) };
  }

  if (existing.status !== "SUSPENDED") {
    return { outcome: "rejected", problem: invalidTransitionError(`Organization ${orgId} is ${existing.status}, not SUSPENDED -- cannot reactivate`, instance) };
  }

  const updated: OrganizationRow = { ...existing, status: "ACTIVE", rowVersion: existing.rowVersion + 1, updatedAt: nowIso, updatedBy: actorRef };
  store.update(updated);

  if (auditLog) {
    writeAuditLogEntry(
      { id: auditLog.newId, category: "ADMIN", actorRef, targetRef: orgId, action: "REACTIVATE", detail: {}, reason: "Organization reactivated" },
      auditLog.store,
      nowIso,
    );
  }

  return { outcome: "reactivated", row: updated };
}

export type DeleteOrganizationResult =
  | { outcome: "deleted"; row: OrganizationRow }
  | { outcome: "rejected"; problem: ProblemDetails };

/** `POST /organizations/{orgId}/delete`. Terminal -- from `ACTIVE` or `SUSPENDED`, never reversible. */
export function deleteOrganization(
  orgId: string,
  reason: string | undefined,
  actorRef: string,
  store: OrganizationStore,
  nowIso: string,
  instance: string,
  auditLog?: AuditLogWrite,
): DeleteOrganizationResult {
  if (!reason) {
    return { outcome: "rejected", problem: schemaValidationError("Missing required field: reason", instance) };
  }

  const existing = store.get(orgId);
  if (!existing) {
    return { outcome: "rejected", problem: notFoundError(`No organization visible with id ${orgId}`, instance) };
  }

  if (existing.status === "DELETED") {
    return { outcome: "rejected", problem: invalidTransitionError(`Organization ${orgId} is already deleted`, instance) };
  }

  const updated: OrganizationRow = { ...existing, status: "DELETED", rowVersion: existing.rowVersion + 1, updatedAt: nowIso, updatedBy: actorRef };
  store.update(updated);

  if (auditLog) {
    writeAuditLogEntry({ id: auditLog.newId, category: "ADMIN", actorRef, targetRef: orgId, action: "DELETE", detail: {}, reason }, auditLog.store, nowIso);
  }

  return { outcome: "deleted", row: updated };
}
