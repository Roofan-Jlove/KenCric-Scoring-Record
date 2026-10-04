/**
 * TASK-0148: `POST /sync/events` -- the thin Edge Function entrypoint
 * `repository-structure.md §9.3` names: "each one's entire body is
 * 'parse the request, call the matching module in `backend/src/`,
 * return its result.'" All real logic lives in `backend/src/sync/
 * pushEvents.ts` (`TASK-0143`-`0147`) and `backend/src/sync/
 * syncEventsPersistence.ts` (`TASK-0148`'s own new module) -- this file
 * does none of it itself.
 *
 * **Never executed -- no Deno runtime or Supabase CLI exists anywhere
 * in this environment** (`which deno`/`which supabase` both fail),
 * confirmed before writing this. Reviewed by hand against Deno/Supabase
 * Edge Function conventions only, the same category every SQL
 * migration and Kotlin file in this backlog already carries. The user
 * explicitly chose to proceed without standing up a local Postgres via
 * Docker too, so this is written and hand-reviewed, not verified
 * end-to-end.
 *
 * **A real, unresolved integration risk, flagged rather than silently
 * assumed away:** `backend/src/`'s own files use `.js`-extension
 * relative import specifiers (`"../authz/errors.js"`, etc.) -- correct
 * for Node's `NodeNext` module resolution, which is how `tsc`/`vitest`
 * actually run them in this repository today. Deno's own module
 * resolver does NOT follow a `.js` specifier to a same-named `.ts` file
 * on disk the way Node's does; every transitive import inside
 * `pushEvents.ts`/`syncEventsPersistence.ts`/the modules THEY import
 * would need either a `deno.json` import map remapping each `.js`
 * specifier to its real `.ts` file, or a build step rewriting
 * specifiers for the Deno target specifically. **Neither is built
 * here** -- solving it needs a real Deno run to iterate against, which
 * this environment cannot provide; inventing one blind would be worse
 * than flagging it as this task's own honest next step.
 *
 * **The client is deliberately user-scoped, never the service role**
 * -- `system-architecture.md §3.8`'s own line: "User-initiated actions
 * still run through a user-scoped client so RLS applies." The
 * `Authorization` header is forwarded as-is so Postgres RLS (the hard
 * boundary, `SEC-004`) enforces tenant isolation underneath every query
 * `syncEventsPersistence.ts` makes, exactly as it would for any other
 * authenticated request.
 */

// @ts-expect-error -- "npm:" specifiers resolve under Deno's own module
// loader, not tsc/Node's; this file is never compiled/run by this
// repository's own backend/ TypeScript project, only reviewed by hand.
import { createClient } from "npm:@supabase/supabase-js@2";
import { pushEvents, type PushEventsRequest } from "../../../../backend/src/sync/pushEvents.ts";
import { hydrateSyncEventsDeps, persistAcceptedEvents } from "../../../../backend/src/sync/syncEventsPersistence.ts";

// @ts-expect-error -- Deno's global, not a Node/tsc ambient type in this project.
Deno.serve(async (req: Request) => {
  const instance = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const authHeader = req.headers.get("Authorization") ?? "";

  const client = createClient(
    // @ts-expect-error -- Deno.env, same reason as Deno.serve above.
    Deno.env.get("SUPABASE_URL"),
    // @ts-expect-error -- Deno.env, same reason as Deno.serve above.
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
  const userId = userData.user.id;

  let request: PushEventsRequest;
  try {
    request = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Request body is not valid JSON.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const deps = await hydrateSyncEventsDeps(client, request, userId);
  const result = pushEvents(request, userId, deps.eventStore, deps.fenceStore, deps.officialStore, deps.matchOfficialStore, instance, deps.featureFlagStore);

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  if (request.matchId) {
    await persistAcceptedEvents(client, request.matchId, deps.eventStore, new Date().toISOString());
  }

  return new Response(JSON.stringify(result.response), { status: 200, headers: { "content-type": "application/json" } });
});
