/**
 * TASK-0155: `POST /organizations/{orgId}/invitations` -- the thin Edge
 * Function entrypoint. `§11.5`'s own Send request: `{ email, roles,
 * expiresAt }` in the body; `organizationId` comes from the URL path,
 * not the body. Response `201`: `{ id, token, expiresAt }`.
 *
 * **Two Supabase clients, not one** -- `invitations` has no write
 * grant at all (the same gap `TASK-0151`-`0154` already found for
 * `disputes`/`organizations`/`memberships`/`matches`), so "Org-admin"
 * is enforced at the application layer via the user-scoped client
 * (`isOrganizationAdmin`, reused from `TASK-0152`) before the
 * service-role client performs the write.
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { inviteMemberReal } from "../_shared/backend/invitationsPersistence.js";

interface InviteMemberRequestBody {
  email?: string;
  roles?: string[];
  expiresAt?: string;
}

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const organizationId = url.pathname.split("/").at(-2); // .../organizations/{orgId}/invitations
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

  let body: InviteMemberRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Request body is not valid JSON.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await inviteMemberReal(userClient, serviceClient, {
    payload: { organizationId, email: body.email, roles: body.roles, expiresAt: body.expiresAt },
    newInvitationId: crypto.randomUUID(),
    newToken: crypto.randomUUID(),
    actorRef: userData.user.id,
    nowIso: new Date().toISOString(),
    instance,
  });

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  return new Response(JSON.stringify({ id: result.row.id, token: result.row.token, expiresAt: result.row.expiresAt }), {
    status: 201,
    headers: { "content-type": "application/json" },
  });
});
