/**
 * TASK-0156: `POST /divergences/{divergenceId}/propose` -- the thin
 * Edge Function entrypoint. **No `api-specification.md` endpoint
 * exists for this pair at all** (`divergenceResolution.ts`'s own
 * `TASK-0125` doc comment already says so) -- this URL shape is this
 * task's own reasonable invention, matching the "action as a `POST` on
 * the resource" convention every other command endpoint in this
 * backlog already uses (`/matches/{matchId}/dispute`, etc.), not a
 * documented contract. Request: `{ proposedValue: unknown }`. Response
 * `200` (an update to an existing row, not a creation).
 *
 * **Two Supabase clients, not one** -- `divergences` has no write
 * grant at all (the same gap `TASK-0151`-`0155` already found
 * repeatedly), and the real authz model (a scorer assigned to this
 * divergence's own match) is synthesized, not read from a spec --
 * see `divergenceResolutionPersistence.ts`'s own doc comment for the
 * full reasoning.
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { proposeDivergenceResolutionReal } from "../_shared/backend/divergenceResolutionPersistence.js";

interface ProposeRequestBody {
  proposedValue?: unknown;
}

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const divergenceId = url.pathname.split("/").at(-2); // .../divergences/{divergenceId}/propose
  const instance = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!divergenceId) {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Missing divergenceId in path.", instance }),
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

  let body: ProposeRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Request body is not valid JSON.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await proposeDivergenceResolutionReal(userClient, serviceClient, {
    divergenceId,
    payload: { proposedValue: body.proposedValue },
    actorRef: userData.user.id,
    instance,
  });

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  return new Response(JSON.stringify(result.row), { status: 200, headers: { "content-type": "application/json" } });
});
