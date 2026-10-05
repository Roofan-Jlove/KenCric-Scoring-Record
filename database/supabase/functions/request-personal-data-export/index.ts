/**
 * TASK-0157: `POST /users/me/export` -- the thin Edge Function
 * entrypoint. `§11.9`'s own Response `202`: `{ exportId }`.
 * `Idempotency-Key` required (`§8.1`).
 *
 * **Only ONE Supabase client** -- `§11.9`'s own Authz is "the user
 * themselves only," and `personal_data_exports` was minted with the
 * correct `user_id = auth.uid()` grant from the start (see
 * `accountDataLifecyclePersistence.ts`'s own doc comment) -- no
 * app-level check or privilege escalation is needed, unlike every one
 * of the five prior Edge Functions wired against an already-existing,
 * under-granted table.
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requestPersonalDataExportReal } from "../../../../backend/src/commands/accountDataLifecyclePersistence.ts";

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const instance = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const idempotencyKey = req.headers.get("Idempotency-Key");
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!idempotencyKey) {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Missing required header: Idempotency-Key.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const client = createClient(
    // @ts-expect-error -- Deno.env, same reason as above.
    Deno.env.get("SUPABASE_URL"),
    // @ts-expect-error -- Deno.env, same reason as above.
    Deno.env.get("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/auth/unauthenticated", title: "Unauthenticated", status: 401, detail: "No verified session.", instance }),
      { status: 401, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await requestPersonalDataExportReal(client, {
    userId: userData.user.id,
    idempotencyKey,
    newExportId: crypto.randomUUID(),
    nowIso: new Date().toISOString(),
    instance,
  });

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  return new Response(JSON.stringify({ exportId: result.row.exportId }), { status: 202, headers: { "content-type": "application/json" } });
});
