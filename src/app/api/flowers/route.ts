import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const { data, error } = await supabaseServer
    .from("flowers")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[flowers][GET] supabase error:", error);
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
    const body = (await req.json().catch(() => ({}))) as unknown;
    const msg =
      typeof (body as Record<string, unknown>)?.message === "string"
        ? ((body as Record<string, unknown>).message as string).slice(0, 140)
        : null;

    const { data, error } = await supabaseServer
      .from("flowers")
      .insert([{ message: msg, wilted: false }])
      .select("id, message, created_at, revived_at, wilted")
      .single();

    if (error) {
      console.error("[flowers][POST] supabase insert error:", error);
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
