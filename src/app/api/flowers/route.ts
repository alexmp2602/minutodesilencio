import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "home";
export const revalidate = 0;

const SELECT_COLS =
  "id, message, created_at, revived_at, wilted, color, x, y, z";

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

function errJson(e: unknown, where: string, status = 500) {
  const err = e instanceof Error ? e : new Error(String(e));
  const cause = netCause((err as { cause?: unknown }).cause);

  let msg = err.message || "Error";
  if (isRecord(e) && typeof e.error === "string") msg = e.error;
  else if (
    isRecord(e) &&
    isRecord(e.error) &&
    typeof e.error.message === "string"
  )
    msg = e.error.message;

  console.error(`[api][${where}]`, { msg, cause });

  return NextResponse.json(
    { ok: false, error: `${where}: ${msg}`, cause },
    { status }
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("flowers")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return errJson(error, "flowers.GET", 500);
    return NextResponse.json(
      { ok: true, flowers: data ?? [] },
      { status: 200 }
    );
  } catch (e) {
    return errJson(e, "flowers.GET", 500);
  }
}

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => ({}));
    const body = (isRecord(raw) ? raw : {}) as Record<string, unknown>;

    const message =
      typeof body.message === "string"
        ? body.message.trim().slice(0, 140)
        : null;

    const x = typeof body.x === "number" ? body.x : null;
    const y = typeof body.y === "number" ? body.y : null;
    const z = typeof body.z === "number" ? body.z : null;

    const color =
      typeof body.color === "string" && body.color.trim()
        ? body.color.trim()
        : null;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("flowers")
      .insert([{ message, x, y, z, color, wilted: false }])
      .select(SELECT_COLS)
      .single();

    if (error) return errJson(error, "flowers.POST", 500);
    return NextResponse.json({ ok: true, flower: data }, { status: 201 });
  } catch (e) {
    return errJson(e, "flowers.POST", 500);
  }
}
