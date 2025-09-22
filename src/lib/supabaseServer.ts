// src/lib/supabaseServer.ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getSupabaseServer(): SupabaseClient {
  if (client) return client;

  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";

  if (!url)
    throw new Error("Missing env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!key)
    throw new Error(
      "Missing env: SUPABASE_SERVICE_ROLE or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );

  const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;

  client = createClient(cleanUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
  });

  return client;
}
