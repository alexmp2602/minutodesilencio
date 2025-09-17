// src/app/api/flowers/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

// Ejecutar siempre en Node (no Edge) y sin cache agresiva
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "home";

const SELECT_COLS =
  "id, message, created_at, revived_at, wilted, color, x, y, z";

// --- utils de tipos/guards ---
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

// Elige el mejor mensaje legible para Error/PostgrestError/{ error: ... }/etc.
function pickMessage(e: unknown): string {
  if (e instanceof Error) return e.message || "Error";

  if (isRecord(e)) {
    // Nuestra API: { error: string }
    if (typeof e.error === "string") return e.error;

    // Algunas APIs: { error: { message } }
    if (isRecord(e.error) && typeof e.error.message === "string") {
      return e.error.message;
    }

    // Postgrest/Supabase
    if (typeof e.message === "string") return e.message;
    if (typeof e.hint === "string") return e.hint;
    if (typeof e.details === "string") return e.details;
    if (typeof e.code === "string") return `code ${e.code}`;
  }

  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function errJson(e: unknown, where: string, status = 500) {
  const cause = netCause((e as { cause?: unknown })?.cause);
  const msg = pickMessage(e);
  return NextResponse.json(
    { ok: false, error: `${where}: ${msg}`, cause },
    { status }
  );
}

// ---- GET ----
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("flowers")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return errJson(error, "flowers.GET");
    return NextResponse.json({ ok: true, flowers: data ?? [] });
  } catch (e: unknown) {
    return errJson(e, "flowers.GET");
  }
}

// ---- POST ----
export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = (isRecord(raw) ? raw : {}) as Record<string, unknown>;

    const msg =
      typeof body.message === "string"
        ? body.message.trim().slice(0, 140)
        : null;

    // Posición opcional (si no viene, queda null)
    const numOrNull = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;

    const x = numOrNull(body.x);
    const y = numOrNull(body.y);
    const z = numOrNull(body.z);

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("flowers")
      .insert([{ message: msg, x, y, z, wilted: false }])
      .select(SELECT_COLS)
      .single();

    if (error) return errJson(error, "flowers.POST");
    return NextResponse.json({ ok: true, flower: data }, { status: 201 });
  } catch (e: unknown) {
    return errJson(e, "flowers.POST", 500);
  }
}
