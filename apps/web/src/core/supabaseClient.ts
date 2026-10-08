import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    "VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are not set -- copy apps/web/.env.local.example or run the local Supabase stack (`npx supabase start` in database/supabase/) and populate apps/web/.env.local from its own printed ANON_KEY.",
  );
}

export const supabase = createClient(url, anonKey);
