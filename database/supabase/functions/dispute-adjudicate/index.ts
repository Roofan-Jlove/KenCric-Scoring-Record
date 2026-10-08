/**
 * TASK-0151: `POST /matches/{matchId}/dispute/adjudicate` -- the thin
 * Edge Function entrypoint. `§11.4`'s own Request shape: `{ ruling:
 * text, resultingCorrections: [uuid]|null }`. Response `200`.
 *
 * Same two-client shape as `dispute-lock/index.ts` -- see that file's
 * own doc comment, and `disputeMatchPersistence.ts`'s, for the full
 * reasoning (`disputes` has no write policy; "Org-admin" is enforced
 * at the application layer via the user-scoped client; the actual
 * writes use the service-role client).
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { adjudicateDisputeReal } from "../_shared/backend/disputeMatchPersistence.js";

interface DisputeAdjudicateRequestBody {
  ruling?: string;
  resultingCorrections?: readonly string[] | null;
}

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const matchId = url.pathname.split("/").at(-3); // .../matches/{matchId}/dispute/adjudicate
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

  let body: DisputeAdjudicateRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Request body is not valid JSON.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await adjudicateDisputeReal(userClient, serviceClient, {
    matchId,
    payload: { ruling: body.ruling, resultingCorrections: body.resultingCorrections },
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
