/**
 * FEATURE: Server-side database client
 * WHAT: A Supabase client that uses the service role key. It only ever runs on
 *       the server (never shipped to the browser).
 * WHY service role: sign-in is handled by Auth.js, so every Server Action checks
 *       the session and ownership itself and then calls Postgres. The ownership
 *       rules are repeated inside the SECURITY DEFINER RPCs (soft_delete_listing,
 *       place_bid, ...) and in RLS policies for anyone using the public key.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// WHY untyped rows: queries join tables with select strings built from shared
// constants, and every row is mapped into a typed UI shape right after (see
// features/*/queries.ts), so the mapping functions are where types are enforced.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;
let client: Db | null = null;

/**
 * Returns the shared service-role client.
 * @throws if the Supabase URL or service key is missing from .env.local.
 */
export function db(): Db {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    throw new Error("Database is not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local.");
  }
  client ??= createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}

/** True when the server can talk to the database. */
export const dbReady = () => Boolean(env.supabaseUrl && env.supabaseServiceKey);
