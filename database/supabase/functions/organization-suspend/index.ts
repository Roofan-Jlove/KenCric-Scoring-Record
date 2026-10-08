/**
 * TASK-0152: `POST /organizations/{orgId}/suspend` -- the thin Edge
 * Function entrypoint. No `api-specification.md` endpoint was ever
 * written for this pair (`organizationLifecycle.ts`'s own `TASK-0133`
 * doc comment already notes this) -- `200` with the updated
 * organization row is this task's own reasonable choice, matching the
 * shape `dispute-lock`'s own `200` response already uses for an
 * analogous "state transition reflected" action.
 *
 * **Two Supabase clients, not one** -- see
 * `organizationLifecyclePersistence.ts`'s own doc comment for the full
 * reasoning: `organizations_update`'s own RLS policy is deliberately
 * coarse (any ACTIVE member, not just an org-admin), so a real
 * "org-admin only" check is enforced at the application layer via the
 * user-scoped client before the service-role client performs the
 * actual write.
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { suspendOrganizationReal } from "../_shared/backend/organizationLifecyclePersistence.js";

interface SuspendRequestBody {
  reason?: string;
}

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const organizationId = url.pathname.split("/").at(-2); // .../organizations/{orgId}/suspend
  const instance = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!organizationId) {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Missing orgId in path.", instance }),
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

  let body: SuspendRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Request body is not valid JSON.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await suspendOrganizationReal(userClient, serviceClient, {
    organizationId,
    reason: body.reason,
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
