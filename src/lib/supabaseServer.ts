// src/lib/supabaseServer.ts
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Evita múltiples instancias en dev con hot-reload
declare global {
  var __sbServerClient__: SupabaseClient | undefined;
}

function isServer() {
  return typeof window === "undefined";
}

function cleanseUrl(raw: string): string {
  const clean = raw.replace(/\/+$/, "");
  // Valida formato de URL; si es inválida, que falle acá con error claro
  new URL(clean);
  return clean;
}

function getEnv(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v : "";
}

function requireAny(...names: string[]): string {
  for (const n of names) {
    const v = getEnv(n);
    if (v) return v;
  }
  throw new Error(`Missing env: one of [${names.join(", ")}]`);
}

let client: SupabaseClient | undefined =
  globalThis.__sbServerClient__ ?? undefined;

/**
 * Cliente de Supabase sólo-servidor.
 * - Prioriza SERVICE_ROLE (API/acciones server); si no, usa ANON KEY (RLS aplica).
 * - Normaliza URL (sin trailing slash) y valida formato.
 * - Singleton estable en dev/production.
 */
export function getSupabaseServer(): SupabaseClient {
  if (!isServer()) {
    throw new Error(
      "[supabaseServer] Este cliente es sólo para entorno de servidor. Usá getSupabaseBrowserClient() en el cliente."
    );
  }

  if (client) return client;

  const rawUrl = requireAny("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const key = requireAny(
    "SUPABASE_SERVICE_ROLE",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  const url = cleanseUrl(rawUrl);

  const usingServiceRole = !!getEnv("SUPABASE_SERVICE_ROLE");
  if (!usingServiceRole) {
    console.warn(
      "[supabaseServer] WARNING: usando ANON KEY en el servidor. " +
        "Asegurate de que tus políticas RLS permitan las operaciones necesarias."
    );
  }

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    // En server no necesitamos Realtime; lo dejamos configurado pero es opcional
    realtime: { params: { eventsPerSecond: 0 } },
    global: {
      fetch, // Next/Node nativo
      headers: {
        "X-Client-Info": usingServiceRole
          ? "mds-server:service"
          : "mds-server:anon",
      },
    },
    // ❗ Quitamos `db: { schema }` para evitar el error de tipo:
    // pasar un string dinámico choca con el genérico literal `"public"`.
  });

  // Cache global para hot-reload en dev
  globalThis.__sbServerClient__ = client;

  // client no es undefined a partir de acá
  return client!;
}
