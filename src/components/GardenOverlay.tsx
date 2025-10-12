"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";
import TI from "@/components/ui/TablerIcon";
import { useMuteStore } from "@/state/muteStore";

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

/* Persistimos última flor (para “Ir a mi flor”) */
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
    window.dispatchEvent(new CustomEvent("ms:plant")); // dispara en la escena
  });
}

export default function GardenOverlay() {
  const { data, isLoading, error, mutate } = useSWR<FlowersResponse>(
    "/api/flowers",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: true }
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

  // 🔊 Zustand
  const muted = useMuteStore((s) => s.muted);
  const toggleMute = useMuteStore((s) => s.toggleMute);

  // SFX plantar (si no existe el archivo, no rompe)
  const sfxRef = React.useRef<HTMLAudioElement | null>(null);
  React.useEffect(() => {
    const el = new Audio("/sfx/plant.mp3");
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.volume = 0.9;
    sfxRef.current = el;
    return () => {
      try {
        el.pause();
        el.srcObject = null;
      } catch {}
    };
  }, []);
  const playSfx = React.useCallback(() => {
    if (muted) return;
    const el = sfxRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
      void el.play();
    } catch {}
  }, [muted]);

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

  // Ir a mi flor (usa __controls publicados por la escena)
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

  async function plant(messageFromUI: string) {
    if (pending) return;
    setErrMsg(null);

    const message = messageFromUI.trim().slice(0, 140) || undefined;
    setPending(true);
    setMsg("");

    try {
      // 1) Pedimos a la escena la posición y que haga el vuelo
      const [px, py, pz] = await askSceneForPlantPosition();

      const optimistic: Flower = {
        id: `temp-${Date.now()}`,
        message: message ?? null,
        color: null,
        created_at: new Date().toISOString(),
        x: px,
        y: py,
        z: pz,
        family: variant,
        user_id: myId,
        user_name: getUserName(),
      };

      await mutate(
        async (current?: FlowersResponse): Promise<FlowersResponse> => {
          // 2) Persistimos con la posición devuelta por la escena
          const res = await fetch("/api/flowers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
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

          // 3) Guardamos “mi flor” para botón rápido + SFX
          if (withPos) saveLastFlower({ x: px, y: py, z: pz, id: withPos.id });
          playSfx();

          const prev = current?.flowers ?? [];
          const next = [withPos, ...prev].filter(Boolean) as Flower[];
          return { flowers: next };
        },
        {
          optimisticData: { flowers: [optimistic, ...(data?.flowers ?? [])] },
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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    plant(msg);
  };

  const labelFor = (v: Variant) =>
    v === "tulip" ? "Tulipán" : v === "daisy" ? "Margarita" : "Rosa";

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !pending) {
      e.preventDefault();
      plant(msg);
    }
  };

  const ui = (
    <div className="ms-garden-overlay" aria-live="polite">
      <div
        className="counter-chip"
        role="status"
        aria-live="polite"
        title="Cantidad total de flores"
      >
        Últimas flores: <strong>{isLoading ? "…" : total}</strong>
      </div>

      <form className="plant-bar" onSubmit={onSubmit} aria-busy={pending}>
        <div className="plant-header">
          <div className="panel-title">Plantar una flor</div>

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
            placeholder="Dejar un mensaje…"
            maxLength={140}
            className="input"
            autoComplete="off"
            disabled={pending}
          />

          <div className="picker" aria-label="Elegir tipo de flor" role="group">
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

          <button
            type="submit"
            className="btn-cta"
            aria-disabled={pending}
            disabled={pending}
          >
            {pending ? "Plantando…" : "Plantar"}
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
