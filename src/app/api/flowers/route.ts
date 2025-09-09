import { NextResponse } from "next/server";

// Opcional: elegí runtime; si no ponés nada, usa Node.js
// export const runtime = 'nodejs'

export async function GET() {
  // endpoint de prueba
  return NextResponse.json({ ok: true, flowers: [] });
}

export async function POST(req: Request) {
  // solo valida que el JSON sea correcto; más adelante conectamos Supabase
  try {
    const body = await req.json();
    // ejemplo: { type: 'rose', message: '...' }
    return NextResponse.json({ ok: true, received: body }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
}
