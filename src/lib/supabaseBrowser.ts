"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function cleanseUrl(raw: string): string {
  const clean = raw.replace(/\/+$/, "");
  // valida URL
  new URL(clean);
  return clean;
}

export function getSupabaseBrowser(): SupabaseClient {
  if (_client) return _client;

  const url =
    (process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ?? "";
  const anon =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ?? "";

  if (!url || !anon) {
    throw new Error(
      "[supabaseBrowser] Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  _client = createClient(cleanseUrl(url), anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _client;
}
