/**
 * TASK-0149: the generic, cross-endpoint real persistence for
 * `idempotency_keys` (`data-specification.md §9.4`, this same task's
 * own schema RCR). `api-specification.md §8.1`/`§8.2` describes one
 * mechanism every command/RPC endpoint with a side effect shares --
 * this module is that mechanism's one real implementation, parameterised
 * by `endpoint` (`§8.2`'s own "idempotency is per-endpoint" rule),
 * rather than a copy hand-written into every command's own persistence
 * wrapper. Lives in `backend/src/commands/` for lack of a better home --
 * `repository-structure.md §8`'s own `backend/src/` tree names no
 * generic cross-cutting-infra directory, and this is closer to "shared
 * command infrastructure" than any one command family.
 *
 * **Only successful outcomes are ever stored, by convention of the
 * caller, not enforced here:** `§8.2`'s own text -- "a failed attempt
 * never poisons the key." This module's own two functions are
 * deliberately unconditional (they persist/read whatever the caller
 * gives them) -- the "only on success" decision belongs to each
 * command's own persistence wrapper (e.g. `signOffMatchPersistence.ts`),
 * which already knows its own pure function's success/rejection shape;
 * baking that decision in here would mean re-deriving "what counts as
 * success" per caller anyway.
 *
 * `NOT integration-tested: no Supabase project exists anywhere in this
 * repository to run this against` -- the same disclaimer `roleContext.ts`/
 * `session.ts`/`syncEventsPersistence.ts` already carry.
 */
export async function getPriorSuccessFromDb(client, endpoint, idempotencyKey) {
    const { data, error } = await client.from("idempotency_keys").select("result").eq("endpoint", endpoint).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (error)
        throw new Error(`getPriorSuccessFromDb: idempotency_keys query failed: ${error.message}`);
    return data ? data.result : null;
}
export async function recordSuccessToDb(client, endpoint, idempotencyKey, result) {
    const { error } = await client.from("idempotency_keys").insert({ endpoint, idempotency_key: idempotencyKey, result });
    if (error)
        throw new Error(`recordSuccessToDb: idempotency_keys insert failed: ${error.message}`);
}
//# sourceMappingURL=idempotencyKeys.js.map