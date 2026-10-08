/**
 * TASK-0152: the generic, cross-endpoint real Postgres adapter for
 * `audit_log`, moved out of `disputeMatchPersistence.ts` (`TASK-0151`,
 * its original and only home) into its own module the moment a SECOND
 * real consumer (`organizationLifecyclePersistence.ts`) needed it --
 * the same "generalise once a second consumer shows up, don't
 * duplicate" shape `idempotencyKeys.ts` already proved out across
 * `signOffMatchPersistence.ts`/`exportJobsPersistence.ts`.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */
/**
 * Seeds the chain head (`getLastHash`) from one real query, captures
 * whatever `writeAuditLogEntry` inserts for real persistence afterward.
 * `audit_log` is one single global chain (no per-category/per-actor
 * partitioning), so `getLastHash`/`insert` both operate on the chain as
 * a whole, matching `auditLog.ts`'s own `AuditLogStore` contract.
 */
export class HydratedAuditLogStore {
    lastHash;
    newlyInserted = [];
    constructor(seededLastHash) {
        this.lastHash = seededLastHash;
    }
    getLastHash() {
        return this.lastHash;
    }
    insert(row) {
        this.lastHash = row.hash;
        this.newlyInserted.push(row);
    }
    list() {
        return [...this.newlyInserted];
    }
    getNewlyInserted() {
        return this.newlyInserted;
    }
}
export async function hydrateAuditLogStore(client) {
    const { data, error } = await client.from("audit_log").select("hash").order("created_at", { ascending: false }).limit(1);
    if (error)
        throw new Error(`hydrateAuditLogStore: audit_log query failed: ${error.message}`);
    const lastHash = data && data.length > 0 ? data[0].hash : null;
    return new HydratedAuditLogStore(lastHash);
}
export async function persistNewAuditLogRows(client, store) {
    const rows = store.getNewlyInserted();
    if (rows.length === 0)
        return;
    const { error } = await client.from("audit_log").insert(rows.map((row) => ({
        id: row.id,
        category: row.category,
        actor_ref: row.actorRef,
        impersonated_actor_ref: row.impersonatedActorRef,
        target_ref: row.targetRef,
        action: row.action,
        detail: row.detail,
        reason: row.reason,
        prev_hash: row.prevHash,
        hash: row.hash,
        created_at: row.createdAt,
    })));
    if (error)
        throw new Error(`persistNewAuditLogRows: audit_log insert failed: ${error.message}`);
}
//# sourceMappingURL=auditLogPersistence.js.map