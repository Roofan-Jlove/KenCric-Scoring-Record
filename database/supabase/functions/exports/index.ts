/**
 * TASK-0150: `POST /matches/{matchId}/exports` -- the thin Edge
 * Function entrypoint, continuing `TASK-0148`/`0149`'s architecture-
 * faithful pattern. `§15.1`'s own Request/Response shape, read
 * verbatim: `{ format, includeBranding }` in, `202 { exportId, status:
 * 'QUEUED' }` out, `Idempotency-Key` required.
 *
 * **`GET /exports/{exportId}` (`§15.2`) is deliberately NOT an Edge
 * Function at all** -- `system-architecture.md §3.9`'s own table puts
 * plain resource reads on PostgREST, and `export_jobs_select_own`'s
 * own RLS policy (`data-specification.md §10.4`) already makes this a
 * correct, zero-code PostgREST read (`GET /rest/v1/export_jobs?
 * export_id=eq.{id}`) -- building a second hand-written entrypoint for
 * it would duplicate what the architecture already gives for free.
 *
 * Never executed -- same disclaimer as `sync-events/index.ts`/
 * `signoff/index.ts`; the same `.js`-vs-`.ts` Deno import-specifier
 * risk those two already flagged applies identically here.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createExportJobReal } from "../_shared/backend/exportJobsPersistence.js";

interface ExportsRequestBody {
  format?: string;
  includeBranding?: boolean;
}

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const matchId = url.pathname.split("/").at(-2); // .../matches/{matchId}/exports
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

  const client = createClient(
    // @ts-expect-error -- Deno.env, same reason as above.
    Deno.env.get("SUPABASE_URL"),
    // @ts-expect-error -- Deno.env, same reason as above.
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

  let body: ExportsRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Request body is not valid JSON.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await createExportJobReal(client, {
    payload: { matchId, format: body.format ?? "", includeBranding: body.includeBranding },
    actorRef: userData.user.id,
    idempotencyKey,
    newExportId: crypto.randomUUID(),
    nowIso: new Date().toISOString(),
    instance,
  });

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  return new Response(JSON.stringify({ exportId: result.row.exportId, status: result.row.status }), { status: 202, headers: { "content-type": "application/json" } });
});
