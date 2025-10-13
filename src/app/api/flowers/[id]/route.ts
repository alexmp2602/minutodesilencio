// src/app/api/flowers/[id]/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "home";
export const revalidate = 0;

const SELECT_COLS =
  "id, message, created_at, revived_at, wilted, color, x, y, z, user_id, user_name, family";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function noCache(res: NextResponse) {
  res.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  return res;
}
function errJson(msg: string, where: string, status = 400) {
  return noCache(
    NextResponse.json({ ok: false, error: `${where}: ${msg}` }, { status })
  );
}
const normalizeMessage = (v: unknown): string | null => {
  if (v === null) return null;
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 140) : null;
};

export async function OPTIONS() {
  return noCache(new NextResponse(null, { status: 204 }));
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const where = "flowers.[id].PATCH";
  try {
    const id = params?.id ?? "";
    if (!UUID_RE.test(id)) return errJson("ID inválido", where, 400);

    interface PatchBody {
      message?: unknown;
    }
    const body = await req.json().catch(() => ({} as PatchBody));
    const message = normalizeMessage(body.message);

    const supabase = getSupabaseServer();

    // 1) ¿La fila existe?
    const exist = await supabase
      .from("flowers")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (exist.error) {
      // error real del select
      return errJson(
        exist.error.message ?? "Error al verificar existencia",
        where,
        400
      );
    }
    if (!exist.data) {
      // no existe
      return errJson("No encontrado", where, 404);
    }

    // 2) Intento de update
    const upd = await supabase
      .from("flowers")
      .update({ message })
      .eq("id", id)
      .select(SELECT_COLS)
      .maybeSingle();

    if (upd.error) {
      return errJson(upd.error.message ?? "Error al actualizar", where, 400);
    }
    if (!upd.data) {
      // Existe pero update afectó 0 filas -> casi seguro RLS
      return errJson("RLS/No autorizado (0 filas actualizadas)", where, 403);
    }

    return noCache(
      NextResponse.json({ ok: true, flower: upd.data }, { status: 200 })
    );
  } catch (e: unknown) {
    const msg =
      typeof e === "object" && e !== null && "message" in e
        ? String((e as { message?: unknown }).message)
        : "Error interno";
    return errJson(msg, where, 500);
  }
}
