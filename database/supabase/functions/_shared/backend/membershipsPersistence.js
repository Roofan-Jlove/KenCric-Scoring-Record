/**
 * TASK-0155: the generic, cross-endpoint real Postgres row mapping for
 * `memberships`, moved out of `deactivateMemberPersistence.ts`
 * (`TASK-0153`, its original and only home) into its own module the
 * moment a SECOND real consumer (`invitationsPersistence.ts`, which
 * needs an INSERT-row mapping for a brand-new membership, a genuinely
 * different shape than `deactivateMember`'s own UPDATE-only mapping)
 * needed the shared read mapping -- the same "generalise on the second
 * real use" shape `idempotencyKeys.ts`/`auditLogPersistence.ts`/
 * `matchesPersistence.ts` already proved out.
 *
 * **Only the full-row read mapping (`mapMembershipRowFromDb`/
 * `hydrateMembership`) lives here -- write-row mapping stays local to
 * each consumer,** the same division `matchesPersistence.ts` already
 * established: `deactivateMember.ts`'s own update only ever touches
 * `status`; `invitations.ts`'s own `acceptInvitation` needs a full
 * INSERT of a brand-new row instead. Two genuinely different shapes
 * over the same table, not one shared shape forced together.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */
export function mapMembershipRowFromDb(row) {
    return {
        id: row.id,
        userId: row.user_id,
        organizationId: row.organization_id,
        roles: row.roles,
        status: row.status,
        invitedAt: row.invited_at ?? null,
        acceptedAt: row.accepted_at ?? null,
        rowVersion: row.row_version,
        createdAt: row.created_at,
        createdBy: row.created_by,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
    };
}
export async function hydrateMembership(client, membershipId) {
    const { data, error } = await client.from("memberships").select("*").eq("id", membershipId).maybeSingle();
    if (error)
        throw new Error(`hydrateMembership: memberships query failed: ${error.message}`);
    return data ? mapMembershipRowFromDb(data) : null;
}
//# sourceMappingURL=membershipsPersistence.js.map