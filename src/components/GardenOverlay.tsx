// app/components/GardenOverlay.tsx
"use client";

import * as React from "react";
import * as THREE from "three";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";
import { useAppStore } from "@/store/useAppStore";
import TI from "@/components/ui/TablerIcon";

type FlowersResponse = { flowers: Flower[] };

const VARIANTS = ["rose", "tulip", "daisy"] as const;
type Variant = (typeof VARIANTS)[number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/* ---------- identidad local mínima ---------- */
function getUserId(): string {
  if (typeof window === "undefined") return "anon";
  const KEY = "ms:userId";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
function getUserName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ms:userName");
}

/* ---------- helpers cámara ↔ suelo ---------- */
const AREA = 200;
const HALF = AREA / 2;
function clampArea(x: number, z: number) {
  return [
    THREE.MathUtils.clamp(x, -HALF + 1, HALF - 1),
    THREE.MathUtils.clamp(z, -HALF + 1, HALF - 1),
  ] as const;
}
function tryGetLookAtOnGround(): readonly [number, number, number] | null {
  if (typeof window === "undefined") return null;
  const cam: THREE.Camera | undefined = (window as Window & { __camera?: THREE.Camera }).__camera;
  if (!cam) return null;
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0
  ray.setFromCamera(new THREE.Vector2(0, 0), cam);
  const pt = new THREE.Vector3();
  if (!ray.ray.intersectPlane(plane, pt)) return null;
  const [x, z] = clampArea(pt.x, pt.z);
  return [x, 0, z] as const;
}

/* ---------- Overlay principal ---------- */
export default function GardenOverlay() {
  const { data, isLoading, error, mutate } = useSWR<FlowersResponse>(
    "/api/flowers",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: true }
  );

  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  const flowers = React.useMemo(() => data?.flowers ?? [], [data]);
  const total = flowers.length;

  const [idx, setIdx] = React.useState(0);
  const variant = VARIANTS[idx]!;

  // mute embebido en el overlay (minimal)
  const muted = useAppStore((s) => s.muted);
  const toggleMute = useAppStore((s) => s.toggleMute);

  // Pos fallback (si no hay cámara global)
  const pickPosFallback = () => {
    const r = 3 + Math.random() * 9;
    const a = Math.random() * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r] as const;
  };

  // Última flor del usuario (para "Ir a mi flor")
  const myId = React.useMemo(
    () => (typeof window !== "undefined" ? getUserId() : "anon"),
    []
  );
  const myLastFlower = React.useMemo(
    () => (flowers as Flower[]).find((f) => f.user_id === myId) ?? null,
    [flowers, myId]
  );

  type OrbitControlsLike = {
    target: { set: (x: number, y: number, z: number) => void };
    object: { position: { set: (x: number, y: number, z: number) => void } };
    update?: () => void;
  };

  const goToMyFlower = React.useCallback(() => {
    if (!myLastFlower) return;
    const controls = (window as { __controls?: OrbitControlsLike })?.__controls;
    if (controls?.target && controls?.object) {
      const f = myLastFlower as Flower;
      controls.target.set(f.x ?? 0, (f.y ?? 0) + 0.6, f.z ?? 0);
      controls.object.position.set(
        (f.x ?? 0) + 4,
        (f.y ?? 0) + 3,
        (f.z ?? 0) + 4
      );
      controls.update?.();
    } else {
      document.dispatchEvent(
        new CustomEvent("goto-flower", {
          detail: {
            x: myLastFlower.x,
            y: myLastFlower.y ?? 0,
            z: myLastFlower.z,
          },
        })
      );
    }
  }, [myLastFlower]);

  async function plant(messageFromUI: string) {
    if (pending) return;
    setErrMsg(null);

    const message = messageFromUI.trim().slice(0, 140) || undefined;
    const look = tryGetLookAtOnGround();
    const [px, py, pz] = (look ?? pickPosFallback()) as [
      number,
      number,
      number
    ];

    const user_id = myId;
    const user_name = getUserName();

    const optimistic: Flower = {
      id: `temp-${Date.now()}`,
      message: message ?? null,
      color: null,
      created_at: new Date().toISOString(),
      x: px,
      y: py,
      z: pz,
      family: variant,
      user_id,
      // @ts-expect-error puede ser null
      user_name,
    };

    setPending(true);
    setMsg("");

    try {
      await mutate(
        async (current?: FlowersResponse): Promise<FlowersResponse> => {
          const res = await fetch("/api/flowers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message,
              x: px,
              y: py,
              z: pz,
              variant,
              user_id,
              user_name,
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
          const ok =
            isRecord(real) &&
            typeof (real as Flower).id === "string" &&
            "created_at" in (real as Flower);

          const withPos: Flower | null = ok
            ? ({ ...(real as Flower), x: px, y: py, z: pz } as Flower)
            : null;

          const prev = current?.flowers ?? [];
          return { flowers: [withPos, ...prev].filter(Boolean) as Flower[] };
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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    plant(msg);
  }

  function labelFor(v: Variant) {
    if (v === "tulip") return "Tulipán";
    if (v === "daisy") return "Margarita";
    return "Rosa";
  }

  return (
    <div className="garden-overlay" aria-live="polite">
      {/* Chip contador (arriba-izq) */}
      <div className="counter-chip" title="Cantidad total de flores">
        Últimas flores: <strong>{isLoading ? "…" : total}</strong>
      </div>

      {/* Panel plantar — centrado y ancho fluido */}
      <form
        className="panel panel-plant plant-bar"
        onSubmit={onSubmit}
        aria-busy={pending}
      >
        {/* Header con acciones a la derecha */}
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

        {/* fila principal: input | selector | botón */}
        <div className="plant-row">
          <label htmlFor="plant-msg" className="sr-only">
            Mensaje (opcional, 140 máx.)
          </label>
          <input
            id="plant-msg"
            name="message"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Dejar un mensaje…"
            maxLength={140}
            className="input input-grow"
            autoComplete="off"
            disabled={pending}
          />

          {/* Selector con flechas + ícono de variante */}
          <div className="picker" aria-label="Elegir tipo de flor" role="group">
            <button
              type="button"
              className="picker-btn"
              onClick={() =>
                setIdx((i) => (i + VARIANTS.length - 1) % VARIANTS.length)
              }
              aria-label="Anterior"
              disabled={pending}
            >
              <TI name="chev-left" />
            </button>

            <div
              className="picker-current"
              title={labelFor(variant)}
              aria-live="polite"
            >
              {/* variante con Tabler */}
              {variant === "tulip" && <TI name="tulip" />}
              {variant === "daisy" && <TI name="daisy" />}
              {variant === "rose" && <TI name="rose" />}
            </div>

            <button
              type="button"
              className="picker-btn"
              onClick={() => setIdx((i) => (i + 1) % VARIANTS.length)}
              aria-label="Siguiente"
              disabled={pending}
            >
              <TI name="chev-right" />
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-cta"
            aria-disabled={pending}
            disabled={pending}
            title="Plantar"
          >
            {pending ? "Plantando…" : "Plantar"}
          </button>
        </div>

        {error && (
          <div role="status" className="hint mt-8">
            No se pudieron cargar las flores.
          </div>
        )}
        {errMsg && (
          <div role="alert" className="mt-16" style={{ color: "#ffadad" }}>
            {errMsg}
          </div>
        )}
      </form>

      {/* Estilos locales del overlay */}
      <style jsx>{`
        .counter-chip {
          position: absolute;
          left: calc(12px + var(--sa-l));
          top: calc(12px + var(--sa-t));
          padding: 6px 10px;
          border-radius: 999px;
          background: color-mix(in oklab, var(--bg) 82%, white 18%);
          border: 1px solid color-mix(in oklab, var(--border) 86%, white 14%);
          font-size: 12px;
          pointer-events: auto;
          box-shadow: var(--shadow-lg);
        }
        .plant-bar {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: max(12px, calc(12px + var(--sa-b)));
          width: min(880px, calc(100vw - 24px - var(--sa-l) - var(--sa-r)));
          pointer-events: auto;
        }
        .plant-header {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          margin-bottom: 8px;
        }
        .header-actions {
          display: grid;
          grid-auto-flow: column;
          gap: 8px;
          align-items: center;
        }
        .icon-btn {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          transition: transform 0.08s ease, background 0.15s ease;
        }
        .icon-btn:active {
          transform: scale(0.96);
        }

        .plant-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          align-items: center;
        }
        .input-grow {
          min-width: 0;
        }

        .picker {
          display: grid;
          grid-auto-flow: column;
          align-items: center;
          gap: 6px;
          background: rgba(0, 0, 0, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.12);
          padding: 6px;
          border-radius: 12px;
        }
        .picker-btn {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-weight: 700;
          line-height: 1;
        }
        .picker-current {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .btn-cta {
          font-weight: 800;
        }

        @media (max-width: 560px) {
          .plant-row {
            gap: 8px;
          }
          .picker-btn,
          .picker-current {
            width: 34px;
            height: 34px;
          }
          .panel-plant .input::placeholder {
            font-size: 12px;
          }
          .panel-plant .input::-webkit-input-placeholder {
            font-size: 12px;
          }
          .panel-plant .input::-moz-placeholder {
            font-size: 12px;
          }
          .panel-plant .input:-ms-input-placeholder {
            font-size: 12px;
          }
          .panel-plant .input::-ms-input-placeholder {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}
