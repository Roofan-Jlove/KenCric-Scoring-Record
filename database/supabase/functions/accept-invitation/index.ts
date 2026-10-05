/**
 * TASK-0155: `POST /invitations/{token}/accept` -- the thin Edge
 * Function entrypoint. `§11.5`'s own Accept request is `{}` -- the
 * token is the path parameter. Response `200`: the new `memberships`
 * row.
 *
 * **A real authorization check added that `acceptInvitation()`'s own
 * pure logic has NO way to perform at all** -- see
 * `invitationsPersistence.ts`'s own doc comment for the full writeup.
 * `§11.5`'s own Authz is "authenticated as the invited email" -- this
 * entrypoint passes the authenticated user's own `email` (straight
 * from the already-resolved session, no extra query needed) through
 * to `acceptInvitationReal`, which verifies it against the invitation
 * BEFORE ever calling the pure function.
 *
 * Only ONE Supabase client is used here, unlike `invite-member`'s own
 * two -- `acceptInvitation`'s own Authz check (email match) is derived
 * entirely from the already-authenticated session, no separate
 * app-level membership/role lookup is needed. The write itself still
 * goes through this one client acting with the caller's own identity;
 * `invitationsPersistence.ts`'s own `acceptInvitationReal` takes a
 * single client parameter for exactly this reason -- there is no
 * separate "confirm, then escalate" step the way `dispute-lock`/
 * `organization-suspend` need.
 *
 * Never executed -- same disclaimer as every other entrypoint in this backlog.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { acceptInvitationReal } from "../../../../backend/src/commands/invitationsPersistence.ts";

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.pathname.split("/").at(-2); // .../invitations/{token}/accept
  const instance = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!token) {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Missing token in path.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  // @ts-expect-error -- Deno.env, same reason as above.
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: authHeader } } });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/auth/unauthenticated", title: "Unauthenticated", status: 401, detail: "No verified session.", instance }),
      { status: 401, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await acceptInvitationReal(serviceClient, {
    token,
    acceptingUserId: userData.user.id,
    acceptingUserEmail: userData.user.email,
    newMembershipId: crypto.randomUUID(),
    nowIso: new Date().toISOString(),
    instance,
  });

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  return new Response(JSON.stringify(result.row), { status: 200, headers: { "content-type": "application/json" } });
});
