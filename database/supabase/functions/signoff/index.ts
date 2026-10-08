/**
 * TASK-0149: `POST /matches/{matchId}/sign-off` -- the thin Edge
 * Function entrypoint, `repository-structure.md §9`'s own second named
 * example (`signoff/index.ts → backend/src/commands`), picked as the
 * natural continuation of `TASK-0148`'s architecture-faithful pattern.
 *
 * **Never executed** -- same disclaimer as `sync-events/index.ts`
 * (`TASK-0148`): no Deno runtime or Supabase CLI exists anywhere in
 * this environment, and the same `.js`-vs-`.ts` import-specifier risk
 * that entrypoint's own doc comment already flagged applies identically
 * here.
 *
 * **A real, significant deviation from `api-specification.md §11.1`'s
 * own Request field table, made concrete for the first time by wiring
 * this for real -- flagged prominently, not silently carried forward:**
 * `§11.1`'s own Request shape is `{ asOfEventOrdinal, overrideReason }`
 * -- it names NO `checks` field at all. Its own Note explains why: this
 * endpoint "re-runs `SVC-RECONCILER`/`SVC-RESULT-DERIVER` server-side"
 * -- the real contract expects the SERVER to compute the reconciliation
 * check list itself, not receive it from the client. `signOffMatch.ts`'s
 * own `TASK-0105` doc comment already acknowledged `SVC-RECONCILER`
 * doesn't exist anywhere in `backend/` (it lives only as pure Kotlin in
 * `shared/`, never ported) and settled on taking `checks` as an
 * "explicit caller-supplied input" as the interim design -- an already-
 * accepted decision from earlier in this backlog, not reopened here.
 * **This entrypoint therefore accepts `checks` directly in the request
 * body**, a real deviation from `§11.1`'s own documented wire shape,
 * because the alternative (building a real server-side reconciler) is
 * a separate, large undertaking far beyond this task's own scope.
 * **The practical consequence, stated plainly:** a client can claim any
 * `ReconciliationCheck[]` it wants, including an all-`PASS` list for a
 * match that would genuinely fail reconciliation -- there is no
 * server-side re-derivation to catch a dishonest or buggy client. This
 * was always true in principle; wiring the real endpoint is what makes
 * it a live gap rather than a theoretical one.
 *
 * `actorRole`/`previousVersion`/`currentServerEventOrdinal` are, by
 * contrast, ALWAYS server-resolved (`signOffMatchPersistence.ts`),
 * never trusted from the client -- these are exactly the three facts a
 * client could otherwise corrupt the sign-off's own integrity guarantee
 * by claiming for itself.
 */

// @ts-expect-error -- Deno/npm: specifier, never resolved by this repository's own Node/tsc project.
import { createClient } from "npm:@supabase/supabase-js@2";
import { signOffMatchReal } from "../_shared/backend/signOffMatchPersistence.js";
import type { ReconciliationCheck } from "../_shared/backend/signOffMatch.js";

interface SignOffRequestBody {
  checks?: readonly ReconciliationCheck[];
  overrideReason?: string | null;
  asOfEventOrdinal?: number;
}

// @ts-expect-error -- Deno global, same reason as sync-events/index.ts.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const matchId = url.pathname.split("/").at(-2); // .../matches/{matchId}/sign-off
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

  let body: SignOffRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ type: "https://kencric.example/errors/schema/validation-error", title: "Schema validation error", status: 400, detail: "Request body is not valid JSON.", instance }),
      { status: 400, headers: { "content-type": "application/problem+json" } },
    );
  }

  const result = await signOffMatchReal(client, {
    matchId,
    userId: userData.user.id,
    checks: body.checks ?? [],
    overrideReason: body.overrideReason ?? null,
    asOfEventOrdinal: body.asOfEventOrdinal ?? 0,
    idempotencyKey,
    newSignOffId: crypto.randomUUID(),
    nowIso: new Date().toISOString(),
    instance,
  });

  if (result.outcome === "rejected") {
    return new Response(JSON.stringify(result.problem), { status: result.problem.status, headers: { "content-type": "application/problem+json" } });
  }

  return new Response(JSON.stringify(result.row), { status: 201, headers: { "content-type": "application/json" } });
});
