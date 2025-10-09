// src/app/api/flowers/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "home";
export const revalidate = 0;

// incluye user_id y family para el overlay
const SELECT_COLS =
  "id, message, created_at, revived_at, wilted, color, x, y, z, user_id, user_name, family";

const AREA = 200;
const HALF = AREA / 2;

type NetCause = Partial<{
  code: string | number;
  errno: string | number;
  syscall: string;
  address: string;
  port: number;
}>;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const asNumStr = (v: unknown): string | number | undefined =>
  typeof v === "string" || typeof v === "number" ? v : undefined;

function netCause(c: unknown): NetCause {
  if (!isRecord(c)) return {};
  return {
    code: asNumStr(c.code),
    errno: asNumStr(c.errno),
    syscall: typeof c.syscall === "string" ? c.syscall : undefined,
    address: typeof c.address === "string" ? c.address : undefined,
    port: typeof c.port === "number" ? c.port : undefined,
  };
}

/** Intenta formatear correctamente un PostgrestError / FetchError / etc */
function formatErrorMessage(e: unknown): string {
  if (isRecord(e)) {
    if (typeof e.message === "string" && e.message) return e.message;
    if (isRecord(e.error) && typeof e.error.message === "string")
      return e.error.message;
    if (typeof e.error === "string") return e.error;
  }
  if (e instanceof Error && e.message) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function withNoCache(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return res;
}

function errJson(e: unknown, where: string, status = 500) {
  const cause = netCause((e as { cause?: unknown })?.cause);
  const msg = formatErrorMessage(e);
  // Log útil en servidor
  console.error(`[api][${where}]`, { msg, cause, raw: e });

  return withNoCache(
    NextResponse.json(
      { ok: false, error: `${where}: ${msg}`, cause },
      { status }
    )
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function clampArea(x: number, z: number) {
  return [
    clamp(x, -HALF + 1, HALF - 1),
    clamp(z, -HALF + 1, HALF - 1),
  ] as const;
}
function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function normalizeMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 140);
}
function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 40);
  return cleaned || null;
}

/** Respuesta a preflight CORS (por si algún cliente externo la hace) */
export async function OPTIONS() {
  return withNoCache(new NextResponse(null, { status: 204 }));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitQ = numOrNull(url.searchParams.get("limit"));
    const limit = limitQ ? clamp(Math.floor(limitQ), 1, 500) : 200;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("flowers")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return errJson(error, "flowers.GET", 500);

    return withNoCache(
      NextResponse.json({ ok: true, flowers: data ?? [] }, { status: 200 })
    );
  } catch (e) {
    return errJson(e, "flowers.GET", 500);
  }
}

export async function POST(req: Request) {
  try {
    // Aceptamos solo JSON; si no se envía, tomamos {}
    const ct = req.headers.get("content-type")?.toLowerCase() || "";
    const raw = ct.includes("application/json")
      ? await req.json().catch(() => ({}))
      : {};
    const body = (isRecord(raw) ? raw : {}) as Record<string, unknown>;

    const message = normalizeMessage(body.message);

    // Coordenadas
    let x = numOrNull(body.x);
    const y = numOrNull(body.y);
    let z = numOrNull(body.z);

    // Si x/z están fuera del rango, se clampa
    if (x != null && z != null) {
      const [cx, cz] = clampArea(x, z);
      x = cx;
      z = cz;
    }

    // Color opcional
    const color =
      typeof body.color === "string" && body.color.trim()
        ? body.color.trim().slice(0, 32)
        : null;

    // aceptar `variant` o `family`
    const rawFamily =
      (typeof body.variant === "string" ? body.variant : null) ??
      (typeof body.family === "string" ? body.family : null);
    const family =
      rawFamily && ["rose", "tulip", "daisy"].includes(rawFamily)
        ? (rawFamily as "rose" | "tulip" | "daisy")
        : null;

    // opcionales de identidad
    const user_id =
      typeof body.user_id === "string" && body.user_id
        ? body.user_id.slice(0, 120)
        : null;
    const user_name = normalizeName(body.user_name);

    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from("flowers")
      .insert([
        {
          message,
          x,
          y,
          z,
          color,
          wilted: false,
          family,
          user_id,
          user_name,
        },
      ])
      .select(SELECT_COLS)
      .single();

    if (error) return errJson(error, "flowers.POST", 400);

    return withNoCache(
      NextResponse.json({ ok: true, flower: data }, { status: 201 })
    );
  } catch (e) {
    return errJson(e, "flowers.POST", 500);
  }
}
