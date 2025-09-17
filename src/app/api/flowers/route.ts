import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "home";

const SELECT_COLS =
  "id, message, created_at, color, x, y, z, wilted, revived_at";

type NetCause = Partial<{
  code: string | number;
  errno: string | number;
  syscall: string;
  address: string;
  port: number;
}>;

function getNetCause(c: unknown): NetCause {
  if (c && typeof c === "object") {
    const o = c as Record<string, unknown>;
    return {
      code: o.code as string | number | undefined,
      errno: o.errno as string | number | undefined,
      syscall: o.syscall as string | undefined,
      address: o.address as string | undefined,
      port: o.port as number | undefined,
    };
  }
  return {};
}

function errJson(e: unknown, where: string, status = 500) {
  const err = e instanceof Error ? e : new Error(String(e));
  const cause = getNetCause((err as { cause?: unknown }).cause);

  return NextResponse.json(
    {
      ok: false,
      error: `${where}: ${err.message}`,
      cause,
    },
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

    if (error) throw error;
    return NextResponse.json({ ok: true, flowers: data ?? [] });
  } catch (e) {
    console.error("[flowers][GET]", e);
    return errJson(e, "GET flowers");
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const message =
      typeof body.message === "string" ? body.message.slice(0, 140) : null;
    const x = typeof body.x === "number" ? body.x : null;
    const y = typeof body.y === "number" ? body.y : null;
    const z = typeof body.z === "number" ? body.z : null;
    const color = typeof body.color === "string" ? body.color : null;

    const { data, error } = await supabase
      .from("flowers")
      .insert([{ message, x, y, z, color, wilted: false }])
      .select(SELECT_COLS)
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, flower: data }, { status: 201 });
  } catch (e) {
    console.error("[flowers][POST]", e);
    return errJson(e, "POST flowers");
  }
}
