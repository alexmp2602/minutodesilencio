import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "home";
export const revalidate = 0;

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

export async function GET(req: NextRequest) {
  const where = "messages.GET";
  try {
    const { searchParams } = new URL(req.url);
    const lim = Math.max(
      1,
      Math.min(300, Number(searchParams.get("limit") ?? 120))
    );

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("messages")
      .select("id,text,user_id,user_name,created_at")
      .order("created_at", { ascending: false })
      .limit(lim);

    if (error) return errJson(error.message, where, 400);

    return noCache(NextResponse.json({ ok: true, messages: data ?? [] }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return errJson(msg, where, 500);
  }
}

export async function POST(req: NextRequest) {
  const where = "messages.POST";
  try {
    type Body = { text?: unknown; user_id?: unknown; user_name?: unknown };
    const b: Body = await req.json().catch(() => ({} as Body));

    const text =
      typeof b.text === "string"
        ? b.text.replace(/\s+/g, " ").trim().slice(0, 80)
        : "";

    if (!text) return errJson("Texto vacío", where, 400);

    const user_id = typeof b.user_id === "string" ? b.user_id : null;
    const user_name =
      typeof b.user_name === "string" && b.user_name.trim()
        ? b.user_name.trim().slice(0, 60)
        : null;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("messages")
      .insert({ text, user_id, user_name })
      .select("id,text,user_id,user_name,created_at")
      .maybeSingle();

    if (error) return errJson(error.message, where, 400);
    if (!data) return errJson("No se pudo insertar (RLS?)", where, 403);

    return noCache(
      NextResponse.json({ ok: true, message: data }, { status: 201 })
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return errJson(msg, where, 500);
  }
}
