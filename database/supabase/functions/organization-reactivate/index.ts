/**
 * TASK-0152: `POST /organizations/{orgId}/reactivate` -- the thin Edge
 * Function entrypoint. Same two-client shape as `organization-suspend/
 * index.ts` -- see that file's own doc comment and
 * `organizationLifecyclePersistence.ts`'s for the full reasoning. No
 * `reason` field at all -- `reactivateOrganization()`'s own request
 * shape never had one (`organizationLifecycle.ts`, `TASK-0133`).
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { reactivateOrganizationReal } from "../../../../backend/src/commands/organizationLifecyclePersistence.ts";

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const organizationId = url.pathname.split("/").at(-2); // .../organizations/{orgId}/reactivate
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

  const result = await reactivateOrganizationReal(userClient, serviceClient, {
    organizationId,
    reason: undefined,
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
