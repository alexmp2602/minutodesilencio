import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SELECT_COLS =
  "id, message, created_at, color, x, y, z, wilted, revived_at";

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
    const err = e as Error;
    console.error("[flowers][GET]", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServer();

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const msg =
      typeof body.message === "string" ? body.message.slice(0, 140) : null;

    const x = typeof body.x === "number" ? body.x : null;
    const y = typeof body.y === "number" ? body.y : null;
    const z = typeof body.z === "number" ? body.z : null;
    const color = typeof body.color === "string" ? body.color : null;

    const { data, error } = await supabase
      .from("flowers")
      .insert([{ message: msg, x, y, z, color, wilted: false }])
      .select(SELECT_COLS)
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, flower: data }, { status: 201 });
  } catch (e) {
    const err = e as Error;
    console.error("[flowers][POST]", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}
