// src/app/api/flowers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "home";
export const revalidate = 0;

const SELECT_COLS =
  "id, message, created_at, revived_at, wilted, color, x, y, z, user_id, user_name, family";

type FlowerVariant = "rose" | "tulip" | "daisy";
const VARIANTS = new Set<FlowerVariant>(["rose", "tulip", "daisy"]);

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const normalizeMessage = (v: unknown): string | null => {
  if (v === null) return null;
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 140) : null;
};

function noCache(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return res;
}
function errJson(msg: string, where: string, status = 400) {
  return noCache(
    NextResponse.json({ ok: false, error: `${where}: ${msg}` }, { status })
  );
}

export async function OPTIONS() {
  return noCache(new NextResponse(null, { status: 204 }));
}

/** GET /api/flowers  → lista reciente (lim=80 por defecto) */
export async function GET(req: NextRequest) {
  const where = "flowers.GET";
  try {
    const { searchParams } = new URL(req.url);
    const lim = Math.max(
      1,
      Math.min(300, Number(searchParams.get("limit") ?? 80))
    );

    const supabase = getSupabaseServer();
    const q = supabase
      .from("flowers")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(lim);

    const { data, error } = await q;
    if (error) return errJson(error.message, where, 400);

    return noCache(NextResponse.json({ ok: true, flowers: data ?? [] }));
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Error inesperado al listar flores";
    return errJson(msg, where, 500);
  }
}

/** POST /api/flowers  → crea y devuelve la flor insertada */
export async function POST(req: NextRequest) {
  const where = "flowers.POST";
  try {
    type Body = {
      message?: unknown;
      x?: unknown;
      y?: unknown;
      z?: unknown;
      variant?: unknown;
      user_id?: unknown;
      user_name?: unknown;
      family?: unknown; // compat: si viene como 'family'
    };
    const b: Body = await req.json().catch(() => ({} as Body));

    const x = Number(b.x);
    const y = Number(b.y);
    const z = Number(b.z);
    if (!isNum(x) || !isNum(y) || !isNum(z))
      return errJson("Posición inválida (x,y,z)", where, 400);
    // permitimos 'variant' o 'family'
    const famRaw = (b.variant ?? b.family) as string | undefined;
    const family =
      typeof famRaw === "string" && VARIANTS.has(famRaw as FlowerVariant)
        ? (famRaw as FlowerVariant)
        : "rose";

    const message = normalizeMessage(b.message);
    const user_id = typeof b.user_id === "string" ? b.user_id : null;
    const user_name =
      typeof b.user_name === "string" && b.user_name.trim()
        ? b.user_name.trim().slice(0, 60)
        : null;

    const supabase = getSupabaseServer();

    const ins = await supabase
      .from("flowers")
      .insert({
        message,
        x,
        y,
        z,
        family,
        user_id,
        user_name,
      })
      .select(SELECT_COLS)
      .maybeSingle();

    if (ins.error) return errJson(ins.error.message, where, 400);
    if (!ins.data) return errJson("No se pudo insertar (RLS?)", where, 403);

    return noCache(
      NextResponse.json({ ok: true, flower: ins.data }, { status: 201 })
    );
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Error inesperado al crear flor";
    return errJson(msg, where, 500);
  }
}
