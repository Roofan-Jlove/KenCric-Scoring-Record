/**
 * TASK-0153: `POST /organizations/{orgId}/memberships/{membershipId}/deactivate`
 * -- the thin Edge Function entrypoint. `§11.3`'s own Request shape is
 * `{}` -- no body fields at all, the action is the whole request.
 * Response `200`: the membership with `status=DEACTIVATED`.
 *
 * **Two Supabase clients, not one** -- see
 * `deactivateMemberPersistence.ts`'s own doc comment: `memberships` has
 * no write grant/policy at all (the same gap `TASK-0151` found for
 * `disputes`), so "Org-admin" is enforced at the application layer via
 * the user-scoped client (`isOrganizationAdmin`, reused from
 * `TASK-0152`) before the service-role client performs the write.
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { deactivateMemberReal } from "../../../../backend/src/commands/deactivateMemberPersistence.ts";

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const membershipId = segments.at(-2); // .../memberships/{membershipId}/deactivate
  const organizationId = segments.at(-4); // .../organizations/{orgId}/memberships/...
  const instance = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const idempotencyKey = req.headers.get("Idempotency-Key");
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!organizationId || !membershipId || !idempotencyKey) {
    return new Response(
      JSON.stringify({
        type: "https://kencric.example/errors/schema/validation-error",
        title: "Schema validation error",
        status: 400,
        detail: !idempotencyKey ? "Missing required header: Idempotency-Key." : "Missing orgId or membershipId in path.",
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

  const result = await deactivateMemberReal(userClient, serviceClient, {
    organizationId,
    membershipId,
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
