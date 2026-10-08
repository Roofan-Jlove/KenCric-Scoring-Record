/**
 * TASK-0153: the real Postgres I/O layer for the `deactivate-member`
 * Edge Function, continuing `TASK-0148`-`0152`'s architecture-faithful
 * pattern after "mint the next task and continue." Picked as the next
 * natural composition of already-built infrastructure: `deactivateMember.ts`
 * (`TASK-0101`) already uses the `§8.1`/`§8.2` Idempotency-Key mechanism
 * (reuses `idempotencyKeys.ts` directly, `TASK-0149`), and its own
 * Authz line names "Org-admin" (reuses `isOrganizationAdmin`,
 * `TASK-0152`, directly) -- this task is mostly composition, not new
 * infrastructure.
 *
 * **A real, THIRD instance of the "check the grant pattern first"
 * finding, same proximate cause as `disputes` (`TASK-0151`):**
 * `memberships` has NO write grant/policy at all -- its own migration's
 * comment: "membership writes go through a backend command handler
 * once one exists" (written long before any handler existed).
 * `deactivateMember.ts`'s own doc comment says "Authz: Org-admin is
 * deliberately not enforced here, per `FA-7` -- RLS is the real
 * authorization boundary" -- but RLS has NO policy to enforce it
 * through at all, the identical mismatch `TASK-0151` found for
 * `disputes`. Same fix: a user-scoped client resolves `isOrganizationAdmin`
 * (imported directly from `organizationLifecyclePersistence.ts`, not
 * re-derived); a service-role client performs the actual write.
 *
 * **A real integrity check added, not present in the pure function at
 * all:** the URL path carries BOTH `{orgId}` and `{membershipId}`
 * independently -- `deactivateMember()` itself only ever takes
 * `membershipId`, with no way to verify it actually belongs to the
 * org the caller was just confirmed an admin of. An org-admin of org
 * X could otherwise name a `membershipId` belonging to org Y and
 * deactivate someone else's membership entirely. This wrapper checks
 * `membership.organizationId === input.organizationId` after
 * hydration, rejecting with the SAME `404` the pure function already
 * uses for a missing membership -- consistent with `§5.2`'s own
 * anti-enumeration convention (never reveal whether a resource exists
 * under the wrong scope vs. not at all).
 *
 * Same pure-core/IO-shell split as every prior task: `deactivateMember()`
 * itself is unmodified -- called with a throwaway, always-empty
 * `InMemoryIdempotencyStore` (its own internal idempotency check is a
 * guaranteed miss, since the REAL idempotency decision already
 * happened via `idempotencyKeys.ts` before this function is ever
 * called), the same shape `signOffMatchPersistence.ts`/
 * `exportJobsPersistence.ts` already established. `mapMembershipRowFromDb`/
 * `hydrateMembership` (originally built here) moved to a shared
 * `membershipsPersistence.ts` (`TASK-0155`) the moment a second real
 * consumer (`invitationsPersistence.ts`) needed the read mapping.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */
import { authForbidden, notFoundError } from "./errors.js";
import { deactivateMember, InMemoryIdempotencyStore } from "./deactivateMember.js";
import { InMemoryMembershipStore } from "./memberships.js";
import { isOrganizationAdmin } from "./organizationLifecyclePersistence.js";
import { getPriorSuccessFromDb, recordSuccessToDb } from "./idempotencyKeys.js";
import { hydrateMembership } from "./membershipsPersistence.js";
const ENDPOINT = "deactivate-member";
export function mapMembershipRowToUpdateRow(row) {
    return { status: row.status, row_version: row.rowVersion, updated_at: row.updatedAt, updated_by: row.updatedBy };
}
async function persistMembershipUpdate(client, row) {
    const { error } = await client.from("memberships").update(mapMembershipRowToUpdateRow(row)).eq("id", row.id);
    if (error)
        throw new Error(`persistMembershipUpdate: memberships update failed: ${error.message}`);
}
/** `POST /organizations/{orgId}/memberships/{membershipId}/deactivate`. */
export async function deactivateMemberReal(userClient, serviceClient, input) {
    const priorSuccess = await getPriorSuccessFromDb(serviceClient, ENDPOINT, input.idempotencyKey);
    if (priorSuccess)
        return priorSuccess;
    if (!(await isOrganizationAdmin(userClient, input.actorRef, input.organizationId))) {
        return { outcome: "rejected", problem: authForbidden("Only an organization admin may deactivate this membership.", input.instance) };
    }
    const membership = await hydrateMembership(serviceClient, input.membershipId);
    if (membership && membership.organizationId !== input.organizationId) {
        return { outcome: "rejected", problem: notFoundError(`No membership visible with id ${input.membershipId}`, input.instance) };
    }
    const store = new InMemoryMembershipStore();
    if (membership)
        store.insert(membership);
    const result = deactivateMember(input.membershipId, input.idempotencyKey, store, new InMemoryIdempotencyStore(), input.actorRef, input.nowIso, input.instance);
    if (result.outcome === "deactivated") {
        await persistMembershipUpdate(serviceClient, result.row);
        await recordSuccessToDb(serviceClient, ENDPOINT, input.idempotencyKey, result);
    }
    return result;
}
//# sourceMappingURL=deactivateMemberPersistence.js.map