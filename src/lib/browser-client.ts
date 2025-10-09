// src/lib/browser-client.ts
"use client";

import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";

declare global {
  interface Window {
    __supabase?: SupabaseClient;
  }
}

let client: SupabaseClient | undefined;

/**
 * Obtiene (o crea) un SupabaseClient de navegador (singleton).
 * - Reutiliza instancia en `window.__supabase` para soportar HMR/navegación.
 * - Mantiene compat con tu firma actual.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  const isBrowser = typeof window !== "undefined";

  // 1) Reusar instancia previa (HMR, navegación, múltiples montajes)
  if (isBrowser && window.__supabase) return window.__supabase;
  if (client) return client;

  // 2) Config desde .env
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!rawUrl) {
    throw new Error(
      "Config Supabase: falta NEXT_PUBLIC_SUPABASE_URL (revisá tu .env)."
    );
  }
  if (!anonKey) {
    throw new Error(
      "Config Supabase: falta NEXT_PUBLIC_SUPABASE_ANON_KEY (revisá tu .env)."
    );
  }

  // 3) Normalizar & validar URL
  const normalizedUrl = rawUrl.endsWith("/") ? rawUrl.slice(0, -1) : rawUrl;
  try {
    // Valida formato de URL; no usamos el objeto luego, solo su validación
    new URL(normalizedUrl);
  } catch {
    throw new Error(
      `Config Supabase: NEXT_PUBLIC_SUPABASE_URL inválida (${rawUrl}).`
    );
  }

  // 4) Opciones sensatas para browser
  const options: SupabaseClientOptions<"public"> = {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    // global: { headers: { "x-client-info": "mds-web" } }, // opcional
  };

  // 5) Crear cliente una vez
  const c = createClient(normalizedUrl, anonKey, options);

  if (isBrowser) {
    // Single source of truth para hot reloads
    window.__supabase = c;
    return c;
  }

  // Fallback fuera del browser (tests/edge teórico)
  client = c;
  return c;
}
