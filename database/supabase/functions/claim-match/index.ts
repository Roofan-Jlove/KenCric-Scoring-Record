/**
 * TASK-0154: `POST /matches/{matchId}/claim` -- the thin Edge Function
 * entrypoint. `§11.7`'s own Request shape: `{ organizationId: uuid|null }`.
 * Response `200`: the updated `matches` row. `Idempotency-Key` required
 * (`§8.1`, every command/RPC endpoint with a side effect).
 *
 * **Authz is "Authenticated user; no prior role required"** (`§11.7`'s
 * own line, read verbatim) -- unlike `dispute-lock`/`organization-
 * suspend`/`deactivate-member`, there is no app-level permission check
 * to add here; the user-scoped client's `auth.getUser()` call alone
 * satisfies `§11.7`'s own Authz requirement. A service-role client is
 * still used for the actual write, NOT for an authz reason but because
 * `matches`' own write-grant state is unconfirmed (see
 * `claimMatchPersistence.ts`'s own doc comment for the full writeup --
 * `matches` has no RLS and no explicit grant anywhere in this schema,
 * a materially bigger, separately-flagged gap than this endpoint's own
 * narrow needs).
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { claimMatchReal } from "../../../../backend/src/commands/claimMatchPersistence.ts";

interface ClaimMatchRequestBody {
  organizationId?: string | null;
}

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const matchId = url.pathname.split("/").at(-2); // .../matches/{matchId}/claim
  const instance = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const idempotencyKey = req.headers.get("Idempotency-Key");
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!matchId || !idempotencyKey) {
    return new Response(
      JSON.stringify({
        type: "https://kencric.example/errors/schema/validation-error",
        title: "Schema validation error",
        status: 400,
        detail: !matchId ? "Missing matchId in path." : "Missing required header: Idempotency-Key.",
        instance,
      }),
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

  let body: ClaimMatchRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Request body is not valid JSON.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await claimMatchReal(serviceClient, {
    matchId,
    payload: { organizationId: body.organizationId ?? null },
    idempotencyKey,
    actorRef: userData.user.id,
    nowIso: new Date().toISOString(),
    instance,
  });

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  return new Response(JSON.stringify(result.row), { status: 200, headers: { "content-type": "application/json" } });
});
