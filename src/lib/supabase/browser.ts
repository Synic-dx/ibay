"use client";
/**
 * FEATURE: Browser Supabase client (Realtime only)
 * WHAT: Uses the public anon key. It only subscribes to:
 *   - bids and listings changes (public data, for live auctions), and
 *   - a private "ping" channel per user (no message content, just "refresh").
 * All reads and writes go through our Server Actions, never from the browser.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function browserClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
