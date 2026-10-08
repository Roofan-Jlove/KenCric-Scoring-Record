/**
 * TASK-0157: `DELETE /users/me` -- the thin Edge Function entrypoint.
 * `§11.9`'s own Response `202`: `{ status: 'PROCESSING' }`.
 * `Idempotency-Key` required (`§8.1`). No polling counterpart exists
 * -- completion is communicated by email, per `§11.9`'s own text.
 *
 * Only ONE Supabase client -- same reasoning as `request-personal-
 * data-export/index.ts`.
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { requestAccountDeletionReal } from "../_shared/backend/accountDataLifecyclePersistence.js";

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

  const result = await requestAccountDeletionReal(client, {
    userId: userData.user.id,
    idempotencyKey,
    nowIso: new Date().toISOString(),
    instance,
  });

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  return new Response(JSON.stringify({ status: result.row.status }), { status: 202, headers: { "content-type": "application/json" } });
});
