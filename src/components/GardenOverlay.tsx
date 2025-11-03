// src/components/GardenOverlay.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";
import TI from "@/components/ui/TablerIcon";
import { useMuteStore } from "@/state/muteStore";
import useSfx from "@/hooks/useSfx";

/* --------------------------------- Types --------------------------------- */
type FlowersResponse = { flowers: Flower[] };
const VARIANTS = ["rose", "tulip", "daisy"] as const;
type Variant = (typeof VARIANTS)[number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/* --------------------------------- Utils --------------------------------- */
const clamp = (n: number, a = 0, b = 99) => Math.max(a, Math.min(b, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ----------------------------- UUID seguro ----------------------------- */
function safeUUID(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    )
      return crypto.randomUUID();
  } catch {}
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.getRandomValues === "function"
    ) {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
        16,
        20
      )}-${h.slice(20)}`;
    }
  } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* --------------------------- Identidad local --------------------------- */
function getUserId(): string {
  if (typeof window === "undefined") return "anon";
  const KEY = "ms:userId";
  let id: string | null = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {}
  if (!id) {
    id = safeUUID();
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  }
  return id;
}
function getUserName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("ms:userName");
  } catch {
    return null;
  }
}

/* -------------------------- Persistencia local -------------------------- */
type LastFlower = { x: number; y: number; z: number; id?: string };
const LAST_KEY = "ms:lastFlower";
function saveLastFlower(pos: LastFlower) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(pos));
  } catch {}
}
function readLastFlower(): LastFlower | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (
      j &&
      typeof j.x === "number" &&
      typeof j.y === "number" &&
      typeof j.z === "number"
    ) {
      return j as LastFlower;
    }
  } catch {}
  return null;
}

/* --------------------------- Comunicación 3D --------------------------- */
function askSceneForPlantPosition(): Promise<
  readonly [number, number, number]
> {
  return new Promise((resolve) => {
    const once = (e: Event) => {
      const de = e as CustomEvent<{ position: [number, number, number] }>;
      window.removeEventListener("ms:plant:done", once as EventListener);
      resolve(de.detail.position);
    };
    window.addEventListener("ms:plant:done", once as EventListener, {
      once: true,
    });
    window.dispatchEvent(new CustomEvent("ms:plant"));
  });
}

/* ======================================================================= */
export default function GardenOverlay() {
  const { data, isLoading, error, mutate } = useSWR<FlowersResponse>(
    "/api/flowers",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: true }
  );

  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [errMsg, setErrMsg] = React.useState<string | null>(null);
  const [portalEl, setPortalEl] = React.useState<Element | null>(null);
  React.useEffect(() => setPortalEl(document.body), []);

  const flowers = React.useMemo(() => data?.flowers ?? [], [data]);
  const total = flowers.length;

  const [idx, setIdx] = React.useState(0);
  const variant = VARIANTS[idx]!;

  // 🔊 sonido
  const muted = useMuteStore((s) => s.muted);
  const toggleMute = useMuteStore((s) => s.toggleMute);
  const { play } = useSfx();
  const playSfx = React.useCallback(() => {
    if (muted) return;
    play("plant", { volume: 0.6 });
  }, [muted, play]);

  const myId = React.useMemo(
    () => (typeof window !== "undefined" ? getUserId() : "anon"),
    []
  );
  const myLastFromApi = React.useMemo(
    () => (flowers as Flower[]).find((f) => f.user_id === myId) ?? null,
    [flowers, myId]
  );
  const myLastFromLocal = React.useMemo(readLastFlower, []);
  const myLastFlower = React.useMemo(
    () =>
      myLastFromApi ??
      (myLastFromLocal && {
        id: myLastFromLocal.id ?? "local",
        x: myLastFromLocal.x,
        y: myLastFromLocal.y,
        z: myLastFromLocal.z,
      }),
    [myLastFromApi, myLastFromLocal]
  );

  /* ---------------- Progreso “matar flores” (barra vertical) ---------------- */
  const [progress, setProgress] = React.useState(0); // 0..99
  const targetRef = React.useRef(0);

  // Knobs
  const KILL_INCREMENT = 7; // fallback si no llega percent
  const DECAY_PER_SEC = 1.2; // baja suave (loop)
  const EASE = 0.12; // easing de la UI

  // Helper de test (opcional)
  React.useEffect(() => {
    (window as Window & { msTestKill?: () => void }).msTestKill = () =>
      window.dispatchEvent(new CustomEvent("ms:flower:killed"));
  }, []);

  // Escuchar progreso desde la escena (preferido)
  React.useEffect(() => {
    const onProgress = (e: Event) => {
      const de = e as CustomEvent<{ percent?: number }>;
      const p = de?.detail?.percent;
      if (typeof p === "number" && isFinite(p)) {
        targetRef.current = clamp(Math.floor(p * 100));
      }
    };

    // Compat: si solo llega el kill/regrow
    const onKill = () => {
      targetRef.current = clamp(targetRef.current + KILL_INCREMENT);
    };
    const onRegrow = () => {
      targetRef.current = clamp(targetRef.current - 6);
    };

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

  // Decaimiento natural (las flores vuelven)
  React.useEffect(() => {
    const id = setInterval(() => {
      targetRef.current = clamp(targetRef.current - DECAY_PER_SEC);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Easing hacia el target
  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      setProgress((p) => {
        const next = lerp(p, targetRef.current, EASE);
        if (Math.abs(next - targetRef.current) < 0.05) return targetRef.current;
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = Math.floor(progress);
  const RAIL_W = 36;
  const RAIL_H = 156;
  const RAIL_RADIUS = 12;

  /* ---------------- Navegar hasta mi flor ---------------- */
  type OrbitControlsLike = {
    target: { set: (x: number, y: number, z: number) => void };
    object: { position: { set: (x: number, y: number, z: number) => void } };
    update?: () => void;
  };
  const goToMyFlower = React.useCallback(() => {
    if (!myLastFlower) return;
    const { x: fx, y: fy, z: fz } = myLastFlower;
    const controls = (window as { __controls?: OrbitControlsLike })?.__controls;
    if (controls?.target && controls?.object) {
      controls.target.set(fx ?? 0, (fy ?? 0) + 0.6, fz ?? 0);
      controls.object.position.set((fx ?? 0) + 4, (fy ?? 0) + 3, (fz ?? 0) + 4);
      controls.update?.();
    }
  }, [myLastFlower]);

  /* ---------------- Crear / actualizar flor ---------------- */
  async function createFlower(message: string) {
    setErrMsg(null);
    setPending(true);
    try {
      const [px, py, pz] = await askSceneForPlantPosition();

      await mutate(
        async (current?: FlowersResponse): Promise<FlowersResponse> => {
          const res = await fetch("/api/flowers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: message || undefined,
              x: px,
              y: py,
              z: pz,
              variant,
              user_id: myId,
              user_name: getUserName(),
            }),
          });

          let json: unknown = null;
          try {
            json = await res.json();
          } catch {}

          if (!res.ok) {
            const apiError =
              isRecord(json) && typeof json.error === "string"
                ? json.error
                : `HTTP ${res.status}`;
            throw new Error(apiError);
          }

          const real = isRecord(json)
            ? (json as { flower?: Flower }).flower ?? null
            : null;
          const withPos: Flower | null = real
            ? ({ ...(real as Flower), x: px, y: py, z: pz } as Flower)
            : null;

          if (withPos) saveLastFlower({ x: px, y: py, z: pz, id: withPos.id });
          playSfx();

          const prev = current?.flowers ?? [];
          const next = [withPos, ...prev].filter(Boolean) as Flower[];
          return { flowers: next };
        },
        {
          optimisticData: {
            flowers: [
              {
                id: `temp-${Date.now()}`,
                message: message || null,
                color: null,
                created_at: new Date().toISOString(),
                x: 0,
                y: 0,
                z: 0,
                family: variant,
                user_id: myId,
                user_name: getUserName(),
              },
              ...(data?.flowers ?? []),
            ],
          },
          rollbackOnError: true,
          revalidate: true,
        }
      );
    } catch (err: unknown) {
      setErrMsg(
        err instanceof Error ? err.message : "No se pudo plantar la flor."
      );
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  async function updateMyFlower(messageFromUI: string) {
    if (!myLastFromApi?.id) {
      await mutate();
      setErrMsg("No encontramos tu flor en el servidor. Probá recargar.");
      return;
    }

    setErrMsg(null);
    setPending(true);

    const cleaned = (messageFromUI ?? "").replace(/\s+/g, " ").trim();
    const payload: { message: string | null } = {
      message: cleaned ? cleaned.slice(0, 140) : null,
    };

    try {
      const res = await fetch(`/api/flowers/${myLastFromApi.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: payload.message }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await mutate((current?: FlowersResponse) => {
        const prev = current?.flowers ?? [];
        const next = prev.map((f) =>
          f.id === myLastFromApi!.id ? { ...f, message: payload.message } : f
        );
        return { flowers: next };
      });
    } catch (e: unknown) {
      setErrMsg(
        e instanceof Error
          ? `No se pudo guardar en el servidor (${e.message}).`
          : "No se pudo guardar en el servidor."
      );
    } finally {
      setPending(false);
    }
  }

  /* ---------------- Submit handler ---------------- */
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const message = msg;
    if (myLastFromApi) updateMyFlower(message);
    else createFlower(message);
  };

  const labelFor = (v: Variant) =>
    v === "tulip" ? "Tulipán" : v === "daisy" ? "Margarita" : "Rosa";

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !pending) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  /* ---------------- Mensajitos flotantes ---------------- */
  const TAGS = ["#qepd🙏", "#rip🕊️", "#descansaenpaz💐", "#QEPD❤️‍🩹", "#RIP"];
  const [floaties, setFloaties] = React.useState<
    { id: number; text: string; left: number }[]
  >([]);
  const nextId = React.useRef(1);
  const tagIdx = React.useRef(0);

  React.useEffect(() => {
    const onKill = () => {
      const id = nextId.current++;
      const text = TAGS[tagIdx.current++ % TAGS.length];
      const left = 24 + Math.random() * 260; // posición horizontal
      setFloaties((arr) => [...arr, { id, text, left }]);
      setTimeout(
        () => setFloaties((arr) => arr.filter((f) => f.id !== id)),
        1600
      );
    };
    window.addEventListener("ms:flowers:kill", onKill as EventListener);
    return () =>
      window.removeEventListener("ms:flowers:kill", onKill as EventListener);
  });

  /* ---------------- UI ---------------- */
  const ui = (
    <div
      className="ms-garden-overlay"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        pointerEvents: "none",
      }}
    >
      {/* Anim para floaties */}
      <style>{`
      @keyframes ms-float-up {
        0%   { transform: translateY(0px);   opacity: 0; }
        10%  { opacity: 1; }
        100% { transform: translateY(-52px); opacity: 0; }
      }
      `}</style>

      {/* 🟩 Barra vertical (loop progreso) */}
      <div
        aria-label="Progreso de destrucción de flores"
        role="status"
        style={{
          position: "fixed",
          top: "50%",
          left: 20,
          transform: "translateY(-50%)",
          width: RAIL_W,
          height: RAIL_H,
          pointerEvents: "auto",
          borderRadius: RAIL_RADIUS,
          backdropFilter: "blur(8px)",
          background: "rgba(0,0,0,.25)",
          boxShadow:
            "0 6px 18px rgba(0,0,0,.18), inset 0 0 8px rgba(255,255,255,.12)",
          display: "grid",
          gridTemplateRows: "1fr auto",
          padding: 6,
        }}
        title="Nunca llega a 100%: crecen de nuevo"
      >
        <div
          style={{
            position: "relative",
            alignSelf: "stretch",
            width: "100%",
            borderRadius: RAIL_RADIUS - 4,
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
              height: `${Math.max(1, (pct / 100) * 100)}%`,
              borderRadius: RAIL_RADIUS - 4,
              transition: "height .25s ease",
              background: "linear-gradient(to top, #58c48d, #b5e8c8)",
              boxShadow: "inset 0 0 12px rgba(0,0,0,.12)",
            }}
          />
        </div>

        <div
          style={{
            marginTop: 6,
            textAlign: "center",
            fontWeight: 800,
            fontSize: 13,
            color: "var(--text-strong, #2b3b46)",
            textShadow: "0 1px 0 rgba(255,255,255,.6)",
            userSelect: "none",
          }}
        >
          {pct}%
        </div>
      </div>

      {/* 🔹 Chip superior */}
      <div
        className="counter-chip"
        role="status"
        aria-live="polite"
        title="Cantidad total de flores"
        style={{
          position: "fixed",
          top: 12,
          left: 20 + RAIL_W + 12,
          color: "#fff",
          background: "rgba(0,0,0,.25)",
          border: "1px solid rgba(255,255,255,.2)",
          boxShadow:
            "0 3px 12px rgba(0,0,0,.18), inset 0 0 8px rgba(255,255,255,.1)",
          backdropFilter: "blur(6px)",
          borderRadius: 10,
          padding: "6px 12px",
          fontSize: 14,
          pointerEvents: "auto",
        }}
      >
        Últimas flores: <strong>{isLoading ? "…" : total}</strong>
      </div>

      {/* 🔸 Barra inferior (formulario existente) */}
      <form
        className="plant-bar"
        onSubmit={onSubmit}
        aria-busy={pending}
        style={{
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: "max(16px, calc(16px + var(--sa-b, 0px)))",
          width: "min(1100px, 92vw)",
          pointerEvents: "auto",
          background: "rgba(255,255,245,.85)",
          borderRadius: 16,
          boxShadow: "0 6px 24px rgba(0,0,0,.15)",
          backdropFilter: "blur(10px)",
          padding: 16,
        }}
      >
        <div
          className="plant-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <div
            className="panel-title font-mono"
            style={{
              fontWeight: 400,
              fontSize: "clamp(18px, 2.1vw, 22px)",
              letterSpacing: "0.01em",
              lineHeight: 1.25,
              color: "#2b3b46",
            }}
          >
            Cada flor es una despedida. Dejá tu mensaje.
          </div>

          <div className="header-actions" style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="icon-btn"
              onClick={goToMyFlower}
              disabled={!myLastFlower}
              title={myLastFlower ? "Ir a mi flor" : "Aún no plantaste"}
              aria-label="Ir a mi flor"
            >
              <TI name="goto" />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={toggleMute}
              aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
              title={muted ? "Activar sonido" : "Silenciar sonido"}
            >
              <TI name={muted ? "volume-off" : "volume"} />
            </button>
          </div>
        </div>

        <div
          className="plant-row"
          style={{
            display: "grid",
            gridTemplateColumns: myLastFromApi ? "1fr auto" : "1fr auto auto",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label htmlFor="plant-msg" className="sr-only">
            Mensaje (opcional, 140 máx.)
          </label>
          <input
            id="plant-msg"
            name="message"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              myLastFromApi
                ? myLastFromApi.message
                  ? "Editar tu mensaje…"
                  : "Dejar un mensaje en tu flor…"
                : "Dejar un mensaje…"
            }
            maxLength={140}
            className="input"
            autoComplete="off"
            disabled={pending}
            style={{
              width: "100%",
              height: 44,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.08)",
              padding: "0 12px",
            }}
          />

          {!myLastFromApi && (
            <div
              className="picker"
              aria-label="Elegir tipo de flor"
              role="group"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <button
                type="button"
                className="picker-btn"
                onClick={() =>
                  setIdx((i) => (i + VARIANTS.length - 1) % VARIANTS.length)
                }
                aria-label="Anterior"
                title="Anterior"
                disabled={pending}
              >
                <TI name="chev-left" />
              </button>

              <div
                className="picker-current"
                title={labelFor(variant)}
                aria-live="polite"
              >
                {variant === "tulip" && <TI name="tulip" />}
                {variant === "daisy" && <TI name="daisy" />}
                {variant === "rose" && <TI name="rose" />}
              </div>

              <button
                type="button"
                className="picker-btn"
                onClick={() => setIdx((i) => (i + 1) % VARIANTS.length)}
                aria-label="Siguiente"
                title="Siguiente"
                disabled={pending}
              >
                <TI name="chev-right" />
              </button>
            </div>
          )}

          <button
            type="submit"
            className="btn-cta"
            aria-disabled={pending}
            disabled={pending}
            style={{
              height: 44,
              borderRadius: 12,
              padding: "0 16px",
              background: "#2e6461",
              color: "#fff",
              fontWeight: 700,
              transition: "background .2s ease",
            }}
          >
            {pending
              ? myLastFromApi
                ? "Guardando…"
                : "Plantando…"
              : myLastFromApi
              ? "Actualizar"
              : "Plantar"}
          </button>
        </div>

        {error && (
          <div role="status" style={{ marginTop: 8, color: "#333" }}>
            No se pudieron cargar las flores.
          </div>
        )}
        {errMsg && (
          <div role="alert" style={{ marginTop: 12, color: "#ff4d4d" }}>
            {errMsg}
          </div>
        )}
      </form>

      {/* Mensajes flotantes */}
      {floaties.map((f) => (
        <div
          key={f.id}
          style={{
            position: "fixed",
            bottom: 200,
            left: f.left,
            fontWeight: 700,
            fontSize: 14,
            color: "rgba(255,255,255,.95)",
            textShadow: "0 1px 10px rgba(0,0,0,.4)",
            pointerEvents: "none",
            animation: "ms-float-up 1.6s ease-out forwards",
          }}
        >
          {f.text}
        </div>
      ))}
    </div>
  );

  if (!portalEl) return null;
  return createPortal(ui, portalEl);
}
