"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";
import TI from "@/components/ui/TablerIcon";
import { useMuteStore } from "@/state/muteStore";
import useSfx from "@/hooks/useSfx";

type FlowersResponse = { flowers: Flower[] };
const VARIANTS = ["rose", "tulip", "daisy"] as const;
type Variant = (typeof VARIANTS)[number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/* ---------- UUID seguro ---------- */
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

/* ---------- identidad local ---------- */
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

/* ---------- persistencia local ---------- */
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

/** Espera a que la escena elija una posición y complete el vuelo. */
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

export default function GardenOverlay() {
  const { data, isLoading, error, mutate } = useSWR<FlowersResponse>(
    "/api/flowers",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [errMsg, setErrMsg] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const [portalEl, setPortalEl] = React.useState<Element | null>(null);

  React.useEffect(() => {
    setMounted(true);
    setPortalEl(document.getElementById("overlay-root") ?? document.body);
  }, []);

  const flowers = React.useMemo(() => data?.flowers ?? [], [data]);
  const total = flowers.length;

  const [idx, setIdx] = React.useState(0);
  const variant = VARIANTS[idx]!;

  // 🔊 sonido
  const muted = useMuteStore((s) => s.muted);
  const toggleMute = useMuteStore((s) => s.toggleMute);
  const { playFile } = useSfx();
  const playSfx = React.useCallback(() => {
    if (muted) return;
    playFile([{ src: "/audio/plant.mp3", type: "audio/mpeg" }]);
  }, [muted, playFile]);

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

  /* ---------------- Crear flor ---------------- */
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

  /* ---------------- Actualizar mensaje ---------------- */
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

      let json: unknown = null;
      try {
        json = await res.json();
      } catch {}

      if (!res.ok) {
        const apiError =
          typeof json === "object" &&
          json &&
          "error" in (json as Record<string, unknown>) &&
          typeof (json as Record<string, unknown>).error === "string"
            ? ((json as Record<string, unknown>).error as string)
            : `HTTP ${res.status}`;
        throw new Error(apiError);
      }

      await mutate(
        (current?: FlowersResponse) => {
          const prev = current?.flowers ?? [];
          const next = prev.map((f) =>
            f.id === myLastFromApi!.id ? { ...f, message: payload.message } : f
          );
          return { flowers: next };
        },
        { revalidate: true }
      );
    } catch (e: unknown) {
      await mutate(
        (current?: FlowersResponse) => {
          const prev = current?.flowers ?? [];
          const next = prev.map((f) =>
            f.id === myLastFromApi!.id ? { ...f, message: payload.message } : f
          );
          return { flowers: next };
        },
        { revalidate: true }
      );
      setErrMsg(
        e instanceof Error
          ? `No se pudo guardar en el servidor (${e.message}). El cambio se ve localmente.`
          : "No se pudo guardar en el servidor. El cambio se ve localmente."
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

  /* ---------------- UI ---------------- */
  const ui = (
    <div className="ms-garden-overlay" aria-live="polite">
      <div
        className="counter-chip"
        role="status"
        aria-live="polite"
        title="Cantidad total de flores"
        style={{
          color: "var(--blue-french, #365ec7)",
          background: "var(--panel-chip-bg, rgba(255,255,255,.22))",
          border: "1px solid var(--panel-chip-border, rgba(255,255,255,.45))",
          boxShadow:
            "0 3px 12px rgba(0,0,0,.18), inset 0 0 8px rgba(255,255,255,.15)",
          backdropFilter: "blur(6px)",
        }}
      >
        Últimas flores: <strong>{isLoading ? "…" : total}</strong>
      </div>

      <form className="plant-bar" onSubmit={onSubmit} aria-busy={pending}>
        <div className="plant-header">
          <div className="panel-title">
            {myLastFromApi ? "Tu flor" : "Plantar una flor"}
          </div>

          <div className="header-actions">
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

        <div className="plant-row">
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
          />

          {!myLastFromApi && (
            <div
              className="picker"
              aria-label="Elegir tipo de flor"
              role="group"
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
    </div>
  );

  if (!mounted || !portalEl) return null;
  return createPortal(ui, portalEl);
}
