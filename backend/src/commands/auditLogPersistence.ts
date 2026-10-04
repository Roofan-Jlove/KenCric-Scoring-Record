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

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditLogRow, AuditLogStore } from "./auditLog.js";

/**
 * Seeds the chain head (`getLastHash`) from one real query, captures
 * whatever `writeAuditLogEntry` inserts for real persistence afterward.
 * `audit_log` is one single global chain (no per-category/per-actor
 * partitioning), so `getLastHash`/`insert` both operate on the chain as
 * a whole, matching `auditLog.ts`'s own `AuditLogStore` contract.
 */
export class HydratedAuditLogStore implements AuditLogStore {
  private lastHash: string | null;
  private readonly newlyInserted: AuditLogRow[] = [];

  constructor(seededLastHash: string | null) {
    this.lastHash = seededLastHash;
  }

  getLastHash(): string | null {
    return this.lastHash;
  }

  insert(row: AuditLogRow): void {
    this.lastHash = row.hash;
    this.newlyInserted.push(row);
  }

  list(): AuditLogRow[] {
    return [...this.newlyInserted];
  }

  getNewlyInserted(): readonly AuditLogRow[] {
    return this.newlyInserted;
  }
}

export async function hydrateAuditLogStore(client: SupabaseClient): Promise<HydratedAuditLogStore> {
  const { data, error } = await client.from("audit_log").select("hash").order("created_at", { ascending: false }).limit(1);
  if (error) throw new Error(`hydrateAuditLogStore: audit_log query failed: ${error.message}`);
  const lastHash = data && data.length > 0 ? ((data[0] as Record<string, unknown>).hash as string) : null;
  return new HydratedAuditLogStore(lastHash);
}

export async function persistNewAuditLogRows(client: SupabaseClient, store: HydratedAuditLogStore): Promise<void> {
  const rows = store.getNewlyInserted();
  if (rows.length === 0) return;
  const { error } = await client.from("audit_log").insert(
    rows.map((row) => ({
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
    })),
  );
  if (error) throw new Error(`persistNewAuditLogRows: audit_log insert failed: ${error.message}`);
}
