"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Message } from "@/lib/types";

type Msg = {
  id: string;
  text: string;
  ts: number;
  user_id: string | null; // Updated to remove undefined
  user_name: string | null; // Updated to remove undefined
};

const STORAGE_KEY = "mds:messages";
const MAX_LOCAL = 120;
const LIMIT_FETCH = 120;

function readStorage(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((r) => {
        const obj = r as Partial<Msg>;
        if (
          typeof obj.text === "string" &&
          typeof obj.ts === "number" &&
          typeof obj.id === "string"
        ) {
          return {
            id: obj.id,
            text: obj.text,
            ts: obj.ts,
            user_id: obj.user_id ?? null,
            user_name: obj.user_name ?? null,
          };
        }
        return null;
      })
      .filter((v): v is Msg => v !== null && v.user_id !== undefined && v.user_name !== undefined) // Ensure only Msg types are returned
      .filter((v): v is Msg => 
        (v.user_id === null || typeof v.user_id === 'string') && 
        (v.user_name === null || typeof v.user_name === 'string')
      ) // Ensure user_id and user_name are valid
      .filter((v): v is Msg => v !== null && 
        (v.user_id === null || typeof v.user_id === 'string') && 
        (v.user_name === null || typeof v.user_name === 'string'))
      .filter((v): v is Msg => v !== null && 
        (v.user_id === null || typeof v.user_id === 'string') && 
        (v.user_name === null || typeof v.user_name === 'string'));
  } catch {
    return [];
  }
}
function writeStorage(arr: Msg[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, MAX_LOCAL)));
}

function nowTs() {
  return Date.now();
}

export default function MessageDock({ maxLen = 80 }: { maxLen?: number }) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const [items, setItems] = useState<Msg[]>([]);
  const [online, setOnline] = useState<"sb" | "local">("local");

  const chRef = useRef<RealtimeChannel | null>(null);

  // Carga inicial: intenta Supabase; si falla, usa localStorage
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const sb = getSupabaseBrowser();
        setOnline("sb");

        // fetch inicial
        const { data, error } = await sb
          .from("messages")
          .select("id,text,user_id,user_name,created_at")
          .order("created_at", { ascending: false })
          .limit(LIMIT_FETCH);

        if (error) throw error;

        interface FetchedRow {
            id: string;
            text?: string | null;
            created_at?: string | null;
            user_id?: string | null;
            user_name?: string | null;
        }

        const mapped: Msg[] =
            (((data ?? []) as FetchedRow[]).map((m: FetchedRow) => ({
                id: String(m.id),
                text: String(m.text ?? ""),
                ts: Date.parse(String(m.created_at ?? new Date().toISOString())),
                user_id: m.user_id ?? null,
                user_name: m.user_name ?? null,
            })) as Msg[]) ?? [];

        if (!cancelled) setItems(mapped);

        // suscripción realtime
        const ch = sb
          .channel("messages-feed")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            (payload: { new: Message }) => {
              const r = payload.new;
              setItems((arr) => {
                // evitar duplicar si ya está
                if (arr.some((x) => x.id === r.id)) return arr;
                const msg: Msg = {
                  id: r.id,
                  text: r.text,
                  ts: Date.parse(r.created_at ?? new Date().toISOString()),
                  user_id: r.user_id ?? null,
                  user_name: r.user_name ?? null,
                };
                return [msg, ...arr].slice(0, LIMIT_FETCH);
              });
            }
          )
          .subscribe();
        chRef.current = ch;
      } catch {
        // fallback local
        setOnline("local");
        setItems(readStorage());
      }
    })();

    return () => {
      cancelled = true;
      try {
        chRef.current?.unsubscribe();
      } catch {}
    };
  }, []);

  // submit
  const submit = async () => {
    const t = txt.trim();
    if (!t) return;

    // Siempre truncamos al frontend por consistencia UX
    const clipped = t.slice(0, maxLen);

    if (online === "sb") {
      try {
        const sb = getSupabaseBrowser();

        // optimista
        const tempId = crypto.randomUUID();
        const optimistic: Msg = {
          id: tempId,
          text: clipped,
          ts: nowTs(),
          user_id: null,
          user_name: null,
        };
        setItems((arr) => [optimistic, ...arr].slice(0, LIMIT_FETCH));
        setTxt("");

        const { data, error } = await sb
          .from("messages")
          .insert({ text: clipped }) // user_id/user_name: opcional, se pueden agregar luego
          .select("id,text,user_id,user_name,created_at")
          .maybeSingle();

        if (error || !data) {
          // revertir optimista
          setItems((arr) => arr.filter((m) => m.id !== tempId));
          throw error ?? new Error("No se pudo insertar");
        }

        // Reemplazar el temporal por el real
        const real: Msg = {
          id: String(data.id),
          text: String(data.text ?? ""),
          ts: Date.parse(String(data.created_at ?? new Date().toISOString())),
          user_id: data.user_id ?? null,
          user_name: data.user_name ?? null,
        };

        setItems((arr) => {
          const withoutTemp = arr.filter((m) => m.id !== tempId);
          // Evitar duplicado si llegó via realtime
          if (withoutTemp.some((x) => x.id === real.id)) return withoutTemp;
          return [real, ...withoutTemp].slice(0, LIMIT_FETCH);
        });
        return;
      } catch {
        // si falla supabase, hacemos fallback local para no perder UX
      }
    }

    // Local fallback
    const msg: Msg = {
      id: crypto.randomUUID(),
      text: clipped,
      ts: nowTs(),
      user_id: null, // Add user_id
      user_name: null, // Add user_name
    };
    const updated = [msg, ...items].slice(0, MAX_LOCAL);
    setItems(updated);
    writeStorage(updated);
    setTxt("");
  };

  const line = useMemo(
    () =>
      (items.length
        ? items
        : [{ id: "void", text: "Dejá tu mensaje…", ts: 0 } as Msg]
      ).map((m) => (
        <span
          key={m.id}
          className="pill"
          title={new Date(m.ts).toLocaleString()}
        >
          {m.text}
        </span>
      )),
    [items]
  );

  return (
    <>
      <div
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onTouchStart={() => setOpen(true)}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: 0,
          zIndex: 90,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            margin: "0 auto",
            width: "min(1200px, 94vw)",
            transform: `translateY(${open ? 0 : "-70%"})`,
            transition: "transform .25s ease",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,.14)",
              border: "2px solid #fff",
              borderTop: "none",
              backdropFilter: "blur(8px)",
              borderBottomLeftRadius: 14,
              borderBottomRightRadius: 14,
              overflow: "hidden",
            }}
          >
            <div className="tape">
              <div className="inner">
                {line}
                {line}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, padding: 10 }}>
              <input
                value={txt}
                onChange={(e) => setTxt(e.target.value)}
                maxLength={maxLen}
                placeholder={
                  online === "sb"
                    ? "Escribí tu mensaje (se comparte en vivo)…"
                    : "Escribí tu mensaje (local)…"
                }
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,.8)",
                  background: "rgba(255,255,255,.9)",
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <button
                onClick={submit}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #fff",
                  background: "#1227e6",
                  color: "#fff",
                  cursor: "pointer",
                }}
                aria-label="Publicar mensaje"
              >
                Publicar
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .tape {
          position: relative;
          color: #fff;
          font-size: clamp(12px, 1.6vw, 16px);
          white-space: nowrap;
          border-bottom: 2px solid #fff;
          padding: 8px 0;
        }
        .tape .inner {
          display: inline-block;
          animation: mscroll 18s linear infinite;
        }
        .pill {
          display: inline-block;
          padding: 2px 8px;
          border: 1px solid #fff;
          border-radius: 999px;
          margin-inline: 6px;
          background: rgba(255, 255, 255, 0.06);
        }
        @keyframes mscroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </>
  );
}
