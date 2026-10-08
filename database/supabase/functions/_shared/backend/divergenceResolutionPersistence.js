/**
 * TASK-0156: the real Postgres I/O layer for the `propose-divergence-
 * resolution`/`confirm-divergence-resolution` Edge Functions,
 * continuing `TASK-0148`-`0155`'s architecture-faithful pattern after
 * "mint the next task and continue." Picked as the next remaining
 * already-built, already-tested command per memory's own tracked list
 * -- `divergenceResolution.ts` (`TASK-0125`) is the last one before
 * `accountDataLifecycle.ts`; `mergePlayers.ts` remains explicitly
 * skipped (`PlayerAppearanceLookup` has no real backing anywhere).
 *
 * **A real, FIFTH instance of the "no write grant" finding, same
 * proximate cause as `disputes`/`memberships`/`invitations`:**
 * `divergences`' own migration (`TASK-0125`) grants NO `INSERT`/
 * `UPDATE` to `authenticated` at all -- "detection/propose/confirm all
 * go through backend command handlers... same default-deny-writes
 * convention." `SELECT` is granted to "any org member," matching
 * `disputes_select`'s own original (pre-`TASK-0141`) under-grant shape,
 * not the tightened org-admin-only one.
 *
 * **No `api-specification.md` endpoint exists for this pair at all**
 * (`divergenceResolution.ts`'s own `TASK-0125` doc comment already
 * says so) -- meaning there is no documented Authz line to read
 * verbatim the way `TASK-0151`-`0155` each did. The real authz model
 * is synthesized from `domain-model.md`'s own framing: "Resolution =
 * ONE SCORER proposes an agreed version, the OTHER confirms" --
 * dual-scorer reconciliation, the identical "Head/Assistant Scorer
 * assigned to THIS match" authz shape `pushEvents.ts`'s own
 * `isAuthorizedScorerOnMatch` already established for `§12.1`. Built a
 * new, async, real-Postgres equivalent here (`isAuthorizedScorerOnMatch`)
 * rather than importing the sync, in-memory-store-based original --
 * that one operates on pre-hydrated stores (`pushEvents.ts`'s own
 * pure-core shape), this one does the real queries directly. If a
 * THIRD consumer ever needs this exact async check, extract it then,
 * the same "generalise on the second real use" discipline already
 * applied four times over -- this is the first, not yet the second.
 * `confirmDivergenceResolution()`'s own `confirmedBy !== proposedBy`
 * check already guards against the one-scorer-does-both case; this
 * module's own addition is "a scorer on this match at all," not a
 * finer-grained role distinction.
 *
 * **`proposeDivergenceResolution`/`confirmDivergenceResolution` never
 * INSERT a new `divergences` row -- only `UPDATE` an existing one**
 * (`id` is server-assigned at detection time by `divergenceDetector.ts`,
 * a separate, unbuilt-for-real-wiring module). One combined
 * update-row mapper covers both commands' own mutable fields
 * (`status`/`proposed_value`/`proposed_by`/`confirmed_by`/
 * `resolved_event_id`) -- safe to always include all five even though
 * each command only ever changes a subset, since the unmentioned ones
 * are simply re-written with their own already-correct existing values
 * (the pure function's own object-spread preserves them).
 *
 * Same pure-core/IO-shell split as every prior task:
 * `proposeDivergenceResolution()`/`confirmDivergenceResolution()` are
 * both unmodified.
 *
 * `NOT integration-tested` -- same disclaimer as every other IO module
 * in this backlog.
 */
import { authForbidden } from "./errors.js";
import { confirmDivergenceResolution, proposeDivergenceResolution, } from "./divergenceResolution.js";
import { InMemoryDivergenceStore } from "./divergenceDetector.js";
/** Real-Postgres equivalent of `pushEvents.ts`'s own `isAuthorizedScorerOnMatch`, built against a user-scoped client instead of pre-hydrated stores. */
export async function isAuthorizedScorerOnMatch(userClient, userId, matchId) {
    const { data: officialRows, error: officialsError } = await userClient.from("officials").select("id").eq("user_id", userId);
    if (officialsError)
        throw new Error(`isAuthorizedScorerOnMatch: officials query failed: ${officialsError.message}`);
    const officialIds = (officialRows ?? []).map((row) => row.id);
    if (officialIds.length === 0)
        return false;
    const { data: moRows, error: moError } = await userClient
        .from("match_officials")
        .select("role")
        .eq("match_id", matchId)
        .in("official_id", officialIds)
        .in("role", ["HEAD_SCORER", "ASSISTANT_SCORER"]);
    if (moError)
        throw new Error(`isAuthorizedScorerOnMatch: match_officials query failed: ${moError.message}`);
    return (moRows ?? []).length > 0;
}
export function mapDivergenceRowFromDb(row) {
    return {
        id: row.id,
        matchId: row.match_id,
        overBall: row.over_ball,
        field: row.field,
        streamAId: row.stream_a_id,
        streamBId: row.stream_b_id,
        valueA: row.value_a,
        valueB: row.value_b,
        status: row.status,
        proposedValue: row.proposed_value,
        proposedBy: row.proposed_by ?? undefined,
        confirmedBy: row.confirmed_by ?? undefined,
        resolvedEventId: row.resolved_event_id ?? undefined,
    };
}
export function mapDivergenceRowToUpdateRow(row) {
    return {
        status: row.status,
        proposed_value: row.proposedValue ?? null,
        proposed_by: row.proposedBy ?? null,
        confirmed_by: row.confirmedBy ?? null,
        resolved_event_id: row.resolvedEventId ?? null,
    };
}
async function hydrateDivergence(client, divergenceId) {
    const { data, error } = await client.from("divergences").select("*").eq("id", divergenceId).maybeSingle();
    if (error)
        throw new Error(`hydrateDivergence: divergences query failed: ${error.message}`);
    return data ? mapDivergenceRowFromDb(data) : null;
}
async function persistDivergenceUpdate(client, row) {
    const { error } = await client.from("divergences").update(mapDivergenceRowToUpdateRow(row)).eq("id", row.id);
    if (error)
        throw new Error(`persistDivergenceUpdate: divergences update failed: ${error.message}`);
}
async function seedDivergenceStore(serviceClient, divergenceId) {
    const divergence = await hydrateDivergence(serviceClient, divergenceId);
    const store = new InMemoryDivergenceStore();
    if (divergence)
        store.insert(divergence);
    return { store, matchId: divergence?.matchId ?? null };
}
/** Propose a divergence resolution. */
export async function proposeDivergenceResolutionReal(userClient, serviceClient, input) {
    const { store, matchId } = await seedDivergenceStore(serviceClient, input.divergenceId);
    if (matchId && !(await isAuthorizedScorerOnMatch(userClient, input.actorRef, matchId))) {
        return { outcome: "rejected", problem: authForbidden("You are not authorized to propose a resolution for this match's divergences.", input.instance) };
    }
    const result = proposeDivergenceResolution(input.divergenceId, input.payload, input.actorRef, store, input.instance);
    if (result.outcome === "proposed") {
        await persistDivergenceUpdate(serviceClient, result.row);
    }
    return result;
}
/** Confirm a proposed divergence resolution. */
export async function confirmDivergenceResolutionReal(userClient, serviceClient, input) {
    const { store, matchId } = await seedDivergenceStore(serviceClient, input.divergenceId);
    if (matchId && !(await isAuthorizedScorerOnMatch(userClient, input.actorRef, matchId))) {
        return { outcome: "rejected", problem: authForbidden("You are not authorized to confirm a resolution for this match's divergences.", input.instance) };
    }
    const result = confirmDivergenceResolution(input.divergenceId, input.payload, input.actorRef, store, input.instance);
    if (result.outcome === "confirmed") {
        await persistDivergenceUpdate(serviceClient, result.row);
    }
    return result;
}
//# sourceMappingURL=divergenceResolutionPersistence.js.map