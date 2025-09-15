import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

const SELECT_COLS =
  "id, message, created_at, color, x, y, z, wilted, revived_at";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("flowers")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[flowers][GET]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, flowers: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const rawMsg = typeof body.message === "string" ? body.message : null;
    const message = rawMsg ? rawMsg.slice(0, 140) : null;

    const x = typeof body.x === "number" ? body.x : null;
    const y = typeof body.y === "number" ? body.y : null;
    const z = typeof body.z === "number" ? body.z : null;
    const color = typeof body.color === "string" ? body.color : null;

    const insertRow = { message, x, y, z, color, wilted: false };

    const { data, error } = await supabaseServer
      .from("flowers")
      .insert([insertRow])
      .select(SELECT_COLS)
      .single();

    if (error) {
      console.error("[flowers][POST]", error);
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, flower: data }, { status: 201 });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error("Invalid JSON");
    console.error("[flowers][POST] handler error:", err);
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 400 }
    );
  }
}
