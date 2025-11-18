"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Message } from "@/lib/types";
import TI from "@/components/ui/TablerIcon";
import { useMuteStore } from "@/state/muteStore";
import useSfx from "@/hooks/useSfx";

/* ----------------------------- Tipos ----------------------------- */
type Msg = {
  id: string;
  text: string;
  ts: number;
  user_id: string | null;
  user_name: string | null;
};

/* ----------------------------- Utilidades ----------------------------- */
const clamp = (n: number, a = 0, b = 99) => Math.max(a, Math.min(b, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const nowTs = () => Date.now();
const STORAGE_KEY = "mds:messages";
const MAX_LOCAL = 120;
const LIMIT_FETCH = 120;

function readStorage(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (m) =>
        m &&
        typeof m.id === "string" &&
        typeof m.text === "string" &&
        typeof m.ts === "number"
    );
  } catch {
    return [];
  }
}
function writeStorage(arr: Msg[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(0, MAX_LOCAL)));
  } catch {}
}

/* ------------------------- Zócalo superior (solo reales) ------------------------- */
function TopMessageTape({ items }: { items: Msg[] }) {
  const pills = React.useMemo(() => {
    const uniq = Array.from(
      new Map(
        (items ?? [])
          .map((m) => ({
            id: m.id,
            txt: (m.text ?? "").replace(/\s+/g, " ").trim(),
            ts: m.ts,
          }))
          .filter((m) => m.txt.length > 0)
          .map((m) => [m.txt.toLowerCase(), m])
      ).values()
    );

    const safe = uniq.length
      ? uniq
      : [{ id: "void", txt: "Dejá tu mensaje…", ts: 0 }];

    return safe.map((m) => (
      <span key={`${m.id}-${m.ts}`} className="pill">
        <span className="hash">#</span> {m.txt}
      </span>
    ));
  }, [items]);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 95,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(0,0,0,.45)",
          borderBottom: "2px solid rgba(255,255,255,.6)",
          backdropFilter: "blur(10px) saturate(160%)",
        }}
      >
        <div className="tapeTop">
          <div className="inner">
            {pills}
            {pills}
          </div>
        </div>
      </div>

      <style jsx>{`
        .tapeTop {
          position: relative;
          color: #fff;
          font-size: clamp(13px, 1.6vw, 18px);
          white-space: nowrap;
          padding: 9px 0;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.7);
        }
        .tapeTop .inner {
          display: inline-block;
          animation: mscroll 28s linear infinite;
        }
        .pill {
          display: inline-block;
          padding: 3px 12px;
          border-radius: 999px;
          margin-inline: 6px;
          border: 1px solid rgba(255, 255, 255, 0.45);
          background: radial-gradient(
            circle at 30% 0%,
            rgba(255, 255, 255, 0.25),
            rgba(255, 255, 255, 0.08)
          );
          backdrop-filter: blur(6px);
        }
        .hash {
          opacity: 0.9;
          margin-right: 2px;
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
    </div>
  );
}

/* ======================================================================= */
export default function GardenOverlay() {
  const [portalEl, setPortalEl] = React.useState<Element | null>(null);
  React.useEffect(() => setPortalEl(document.body), []);

  /* ---------- Sonido ---------- */
  const muted = useMuteStore((s) => s.muted);
  const toggleMute = useMuteStore((s) => s.toggleMute);
  const { play } = useSfx();

  /* ---------- Barra de progreso ---------- */
  const [progress, setProgress] = React.useState(0);
  const targetRef = React.useRef(0);
  const DECAY_PER_SEC = 1.2;
  const EASE = 0.12;

  React.useEffect(() => {
    const onProgress = (e: Event) => {
      const de = e as CustomEvent<{ percent?: number }>;
      const p = de?.detail?.percent;
      if (typeof p === "number") targetRef.current = clamp(Math.floor(p * 100));
    };
    const onKill = () => (targetRef.current = clamp(targetRef.current + 7));
    const onRegrow = () => (targetRef.current = clamp(targetRef.current - 6));

    window.addEventListener("ms:flowers:progress", onProgress as EventListener);
    window.addEventListener("ms:flowers:kill", onKill as EventListener);
    window.addEventListener("ms:flower:killed", onKill as EventListener);
    window.addEventListener("ms:flower:regrow", onRegrow as EventListener);
    return () => {
      window.removeEventListener(
        "ms:flowers:progress",
        onProgress as EventListener
      );
      window.removeEventListener("ms:flowers:kill", onKill as EventListener);
      window.removeEventListener("ms:flower:killed", onKill as EventListener);
      window.removeEventListener("ms:flower:regrow", onRegrow as EventListener);
    };
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => {
      targetRef.current = clamp(targetRef.current - DECAY_PER_SEC);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      setProgress((p) => {
        const next = lerp(p, targetRef.current, EASE);
        return Math.abs(next - targetRef.current) < 0.05
          ? targetRef.current
          : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------- Mensajes (Supabase realtime) ---------- */
  const [open, setOpen] = React.useState(false);
  const [txt, setTxt] = React.useState("");
  const [items, setItems] = React.useState<Msg[]>([]);
  const [online, setOnline] = React.useState<"sb" | "local">("local");
  const chRef = React.useRef<RealtimeChannel | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabaseBrowser();
        setOnline("sb");
        const { data, error } = await sb
          .from("messages")
          .select("id,text,user_id,user_name,created_at")
          .order("created_at", { ascending: false })
          .limit(LIMIT_FETCH);
        if (error) throw error;

        const rows = (data ?? []) as Message[];
        const mapped: Msg[] = rows.map((m) => ({
          id: String(m.id),
          text: String(m.text ?? ""),
          ts: Date.parse(m.created_at ?? new Date().toISOString()),
          user_id: m.user_id ?? null,
          user_name: m.user_name ?? null,
        }));
        if (!cancelled) setItems(mapped);

        const ch = sb
          .channel("messages-feed")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages" },
            (payload: { new: Message }) => {
              const r = payload.new;
              setItems((arr) => {
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
        setOnline("local");
        setItems(readStorage());
      }
    })();
    return () => {
      cancelled = true;
      chRef.current?.unsubscribe();
    };
  }, []);

  async function submitMessage() {
    const text = txt.trim().slice(0, 50);
    if (!text) return;
    setTxt("");

    if (online === "sb") {
      try {
        const sb = getSupabaseBrowser();
        const tempId = crypto.randomUUID();
        const optimistic: Msg = {
          id: tempId,
          text,
          ts: nowTs(),
          user_id: null,
          user_name: null,
        };
        setItems((arr) => [optimistic, ...arr].slice(0, LIMIT_FETCH));
        const { data, error } = await sb
          .from("messages")
          .insert({ text })
          .select("id,text,user_id,user_name,created_at")
          .maybeSingle();
        if (error || !data) throw new Error("Error al guardar");
        const real: Msg = {
          id: String(data.id),
          text: String(data.text ?? ""),
          ts: Date.parse(data.created_at ?? new Date().toISOString()),
          user_id: data.user_id ?? null,
          user_name: data.user_name ?? null,
        };
        setItems((arr) => {
          const w = arr.filter((m) => m.id !== tempId);
          if (w.some((x) => x.id === real.id)) return w;
          return [real, ...w].slice(0, LIMIT_FETCH);
        });
        if (!muted) play("plant", { volume: 0.55 });
        return;
      } catch {}
    }

    const msg: Msg = {
      id: crypto.randomUUID(),
      text,
      ts: nowTs(),
      user_id: null,
      user_name: null,
    };
    const updated = [msg, ...items].slice(0, MAX_LOCAL);
    setItems(updated);
    writeStorage(updated);
    if (!muted) play("plant", { volume: 0.55 });
  }

  /* ---------------------------- UI ---------------------------- */
  const ui = (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 70, pointerEvents: "none" }}
    >
      {/* ZÓCALO SUPERIOR */}
      <TopMessageTape items={items} />

      {/* 🟩 Barra vertical más grande */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: 24,
          transform: "translateY(-50%)",
          width: 50,
          height: 350,
          pointerEvents: "auto",
          borderRadius: 14,
          backdropFilter: "blur(10px)",
          background: "rgba(0,0,0,.3)",
          boxShadow:
            "0 10px 30px rgba(0,0,0,.3), inset 0 0 10px rgba(255,255,255,.12)",
          display: "grid",
          gridTemplateRows: "1fr auto",
          padding: 8,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            borderRadius: 10,
            overflow: "hidden",
            background: "rgba(255,255,255,.06)",
          }}
        >
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              width: "100%",
              height: `${Math.floor(progress)}%`,
              borderRadius: 10,
              transition: "height .28s cubic-bezier(.2,.8,.2,1)",
              background: "linear-gradient(to top,#58c48d,#c9f3da)",
              boxShadow: "inset 0 0 14px rgba(0,0,0,.2)",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 6,
            textAlign: "center",
            fontWeight: 800,
            fontSize: 13,
            color: "#e7f7ee",
            textShadow: "0 1px 0 rgba(0,0,0,.7)",
            userSelect: "none",
          }}
        >
          {Math.floor(progress)}%
        </div>
      </div>

      {/* 🔻 Interfaz inferior */}
      <div
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onTouchStart={() => setOpen(true)}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 90,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            margin: "0 auto",
            width: "min(1200px, 94vw)",
            transform: `translateY(${open ? "0%" : "70%"})`,
            transition: "transform .25s ease",
          }}
        >
          <div
            style={{
              background: "rgba(5, 30, 5, 0.6)",
              borderTop: "1px solid rgba(255, 255, 255, 0.4)",
              borderLeft: "1px solid rgba(255, 255, 255, 0.25)",
              borderRight: "1px solid rgba(255, 255, 255, 0.25)",
              backdropFilter: "blur(12px) saturate(160%)",
              boxShadow:
                "0 -4px 24px rgba(0,0,0,0.35), inset 0 0 10px rgba(255,255,255,0.08)",
              borderRadius: "18px 18px 0 0",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", gap: 8, padding: 10 }}>
              <input
                value={txt}
                onChange={(e) => setTxt(e.target.value)}
                maxLength={50}
                placeholder={
                  online === "sb"
                    ? "Escribí tu mensaje (se comparte en vivo)…"
                    : "Escribí tu mensaje (local)…"
                }
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,.85)",
                  background: "rgba(255,255,255,.92)",
                  outline: "none",
                  fontSize: 14,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitMessage();
                  }
                }}
              />
              <button
                onClick={submitMessage}
                style={{
                  padding: "11px 24px",
                  borderRadius: 14,
                  border: "none",
                  background: "linear-gradient(135deg, #345CFF, #6786FF)",
                  boxShadow:
                    "0 4px 15px rgba(0, 0, 0, 0.35), inset 0 0 8px rgba(255,255,255,0.25)",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 15,
                  letterSpacing: 0.2,
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = "brightness(1.15)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = "brightness(1)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Publicar
              </button>
              <button
                onClick={toggleMute}
                className="icon-btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.45)",
                  background: "rgba(255,255,255,0.18)",
                  backdropFilter: "blur(8px) saturate(150%)",
                  boxShadow:
                    "inset 0 0 6px rgba(255,255,255,0.15), 0 2px 10px rgba(0,0,0,0.35)",
                  color: "#fff",
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.26)";
                  e.currentTarget.style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.18)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <TI
                  name={muted ? "volume-off" : "volume"}
                  size={20}
                  stroke={2}
                  style={{ opacity: 0.9 }}
                />
              </button>
            </div>
          </div>

          {/* lengüeta */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: -14,
              transform: "translateX(-50%)",
              width: 84,
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,.25)",
            }}
          />
        </div>
      </div>

      <Floaties />
    </div>
  );

  if (!portalEl) return null;
  return createPortal(ui, portalEl);
}

/* ----------------------- Floaties ----------------------- */
function Floaties() {
  const [arr, setArr] = React.useState<
    { id: number; text: string; left: number }[]
  >([]);
  const nextId = React.useRef(1);
  const tagIdx = React.useRef(0);

  React.useEffect(() => {
    const TAGS = ["#qepd🙏", "#rip🕊️", "#descansaenpaz💐", "#QEPD❤️‍🩹", "#RIP"];
    const onKill = () => {
      const id = nextId.current++;
      const text = TAGS[tagIdx.current++ % TAGS.length];
      const left = 24 + Math.random() * 260;
      setArr((a) => [...a, { id, text, left }]);
      setTimeout(() => setArr((a) => a.filter((f) => f.id !== id)), 1600);
    };
    window.addEventListener("ms:flowers:kill", onKill as EventListener);
    return () =>
      window.removeEventListener("ms:flowers:kill", onKill as EventListener);
  }, []);

  return (
    <>
      <style>{`
        @keyframes ms-float-up {
          0% { transform: translateY(0px); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(-52px); opacity: 0; }
        }
      `}</style>
      {arr.map((f) => (
        <div
          key={f.id}
          style={{
            position: "fixed",
            bottom: 200,
            left: f.left,
            fontWeight: 700,
            fontSize: 24,
            color: "rgba(255,255,255,.95)",
            textShadow: "0 1px 10px rgba(0,0,0,.4)",
            pointerEvents: "none",
            animation: "ms-float-up 1.6s ease-out forwards",
          }}
        >
          {f.text}
        </div>
      ))}
    </>
  );
}
