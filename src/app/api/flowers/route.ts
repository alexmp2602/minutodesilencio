// src/app/api/flowers/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "home";
export const revalidate = 0;

const SELECT_COLS =
  "id, message, created_at, revived_at, wilted, color, x, y, z, user_id, user_name, family";

function noCache(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return res;
}
function errJson(e: unknown, where: string, status = 400) {
  const msg =
    (typeof e === "object" && e !== null && "message" in e
      ? (e as { message?: string }).message
      : undefined) || String(e);
  return noCache(
    NextResponse.json({ ok: false, error: `${where}: ${msg}` }, { status })
  );
}

export async function OPTIONS() {
  return noCache(new NextResponse(null, { status: 204 }));
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
    return noCache(
      NextResponse.json({ ok: true, flowers: data ?? [] }, { status: 200 })
    );
  } catch (e) {
    return errJson(e, "flowers.GET", 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const normalizeMessage = (v: unknown) => {
      if (typeof v !== "string") return null;
      const t = v.replace(/\s+/g, " ").trim();
      return t ? t.slice(0, 140) : null;
    };

    const message = normalizeMessage((body as Record<string, unknown>).message);
    const x = typeof body.x === "number" ? body.x : null;
    const y = typeof body.y === "number" ? body.y : null;
    const z = typeof body.z === "number" ? body.z : null;
    const color =
      typeof body.color === "string" && body.color.trim()
        ? body.color.trim().slice(0, 32)
        : null;
    const family =
      typeof body.family === "string" &&
      ["rose", "tulip", "daisy"].includes(body.family)
        ? (body.family as "rose" | "tulip" | "daisy")
        : null;
    const user_id =
      typeof body.user_id === "string" && body.user_id
        ? body.user_id.slice(0, 120)
        : null;
    const user_name =
      typeof body.user_name === "string" && body.user_name.trim()
        ? body.user_name.trim().slice(0, 40)
        : null;

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("flowers")
      .insert([
        { message, x, y, z, color, family, user_id, user_name, wilted: false },
      ])
      .select(SELECT_COLS)
      .single();

    if (error) return errJson(error, "flowers.POST", 400);
    return noCache(
      NextResponse.json({ ok: true, flower: data }, { status: 201 })
    );
  } catch (e) {
    return errJson(e, "flowers.POST", 500);
  }
}

// 🚫 Este endpoint no acepta PATCH (para evitar ambigüedad):
export async function PATCH() {
  return noCache(
    NextResponse.json(
      { ok: false, error: "Usá PATCH /api/flowers/:id" },
      { status: 405 }
    )
  );
}
