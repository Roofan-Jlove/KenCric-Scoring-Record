/**
 * TASK-0151: `POST /matches/{matchId}/dispute` -- the thin Edge
 * Function entrypoint, continuing `TASK-0148`-`0150`'s architecture-
 * faithful pattern. `§11.4`'s own Request shape: `{ reason: text }`.
 * `§11.4`'s own Response is `200`, not `201` -- checked directly.
 *
 * **Two Supabase clients, not one** -- see `disputeMatchPersistence.ts`'s
 * own doc comment for the full reasoning: `disputes` has no write
 * policy at all (`§11.4`'s "Org-admin" Authz is enforced at the
 * application layer instead, via the user-scoped client), so the
 * actual writes need the service-role client, which bypasses RLS by
 * design (`system-architecture.md §3.8`'s own explicit sanction).
 * `SUPABASE_SERVICE_ROLE_KEY` is never exposed to any client bundle --
 * it exists only in this server-side Edge Function's own environment.
 *
 * **No `Idempotency-Key` handling** -- `disputeMatchPersistence.ts`'s
 * own doc comment flags this as a real, pre-existing gap in
 * `TASK-0123`'s own original design, not retrofitted here.
 *
 * Never executed -- same disclaimer as `sync-events/`/`signoff/`/
 * `exports/index.ts`.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { lockMatchForDisputeReal } from "../_shared/backend/disputeMatchPersistence.js";

interface DisputeLockRequestBody {
  reason?: string;
}

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const matchId = url.pathname.split("/").at(-2); // .../matches/{matchId}/dispute
  const instance = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!matchId) {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Missing matchId in path.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  // @ts-expect-error -- Deno.env, same reason as above.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: authHeader } } });
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/auth/unauthenticated", title: "Unauthenticated", status: 401, detail: "No verified session.", instance }),
      { status: 401, headers: { "content-type": "application/problem+json" } },
    );
  }

  let body: DisputeLockRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Request body is not valid JSON.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await lockMatchForDisputeReal(userClient, serviceClient, {
    matchId,
    payload: { reason: body.reason },
    newDisputeId: crypto.randomUUID(),
    newAuditLogId: crypto.randomUUID(),
    actorRef: userData.user.id,
    nowIso: new Date().toISOString(),
    instance,
  });

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  return new Response(JSON.stringify(result.row), { status: 200, headers: { "content-type": "application/json" } });
});
