/**
 * Resolves the requesting user's id from a verified session -- never by
 * hand-decoding the raw JWT. SR-B01: no client-supplied role/identity
 * claim is ever trusted directly; @supabase/supabase-js's own
 * auth.getUser() call verifies the token against the auth server and
 * returns the authenticated identity, which is the only trustworthy
 * source used here.
 *
 * NOT integration-tested in this task: no Supabase project exists
 * anywhere in this repository yet to run this against.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function resolveUserId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error("resolveUserId: no verified session (auth/unauthenticated)");
  }

  return data.user.id;
}
