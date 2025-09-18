"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  interface Window {
    __supabase?: SupabaseClient;
  }
}

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window !== "undefined" && window.__supabase)
    return window.__supabase;
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anon) {
    throw new Error(
      "Faltan variables NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  if (url.endsWith("/")) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL no debe terminar con "/"');
  }

  const c = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  if (typeof window !== "undefined") window.__supabase = c;
  else client = c;

  return c;
}
