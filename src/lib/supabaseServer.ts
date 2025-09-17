// src/lib/supabaseServer.ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * Cliente de Supabase sólo para el servidor (Node runtime).
 * Requiere:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE   (o, en su defecto, NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */
export function getSupabaseServer(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Missing env: SUPABASE_URL");
  }
  if (!serviceKey) {
    throw new Error(
      "Missing env: SUPABASE_SERVICE_ROLE (o NEXT_PUBLIC_SUPABASE_ANON_KEY)"
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Importante: NO sobreescribimos fetch. Dejamos el nativo de Node/Vercel.
    global: { fetch },
  });

  return cached;
}
