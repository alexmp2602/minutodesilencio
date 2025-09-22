// app/components/GardenOverlay.tsx
"use client";

import * as React from "react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";

type FlowersResponse = { flowers: Flower[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/* ========= Variantes de vista previa ========= */
const VARIANTS = ["rose", "tulip", "daisy"] as const;
type Variant = (typeof VARIANTS)[number];

function PixelRose({
  size = 120,
  color = "#E4B8FF",
}: {
  size?: number;
  color?: string;
}) {
  // “Matriz” de puntos (1 = punto visible) para formar una rosa simple
  // Cada string es una fila; ajustado a quedar centrado en 14x18 aprox.
  const rows = [
    "......1111......",
    ".....111111.....",
    "....11111111....",
    "...1111111111...",
    "...1111111111...",
    "....11111111....",
    ".....111111.....",
    "......1111......",
    ".......11.......",
    "....11111111....",
    "...1111111111...",
    "..111111111111..",
    "..111111111111..",
    "...1111111111...",
    "......1111......",
    "........1.......",
  ];
  const dot = (i: number, j: number) => rows[i]?.[j] === "1";

  const w = rows[0].length;
  const h = rows.length;
  const pad = 8;
  const viewW = w + pad * 2;
  const viewH = h + pad * 2;
  const dotR = 0.9; // radio en coords del grid

  const dots: JSX.Element[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dot(y, x)) {
        dots.push(
          <circle
            key={`${x}-${y}`}
            cx={x + pad}
            cy={y + pad}
            r={dotR}
            fill={color}
            opacity={0.95}
          />
        );
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      width={size}
      height={(size * viewH) / viewW}
      aria-hidden="true"
    >
      <g filter="url(#glow)" transform="translate(0,0)">
        {dots}
      </g>
      {/* tallo + hojas “pixel” */}
      <g fill={color} opacity={0.9}>
        <rect
          x={viewW / 2 - 0.6}
          y={pad + h * 0.55}
          width={1.2}
          height={h * 0.28}
          rx={0.6}
        />
        <ellipse
          cx={viewW / 2}
          cy={pad + h * 0.92}
          rx={3.6}
          ry={1.2}
          opacity={0.25}
        />
        {/* hojas */}
        <path
          d={`M ${viewW / 2 - 0.6} ${pad + h * 0.7} q -5 2 -6 6 q 6 -1 7 -5 z`}
        />
        <path
          d={`M ${viewW / 2 + 0.6} ${pad + h * 0.76} q 6 0 8 4 q -6 -2 -8 -4 z`}
        />
      </g>

      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

function FlowerPreview({ variant = "rose" as Variant }) {
  const color = "#E4B8FF";

  if (variant === "tulip") {
    return (
      <svg viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">
        <g fill={color}>
          <path d="M60 38c10 14 22 14 22 32 0 16-10 26-22 26s-22-10-22-26c0-18 12-18 22-32Z" />
          <rect x="58" y="96" width="4" height="42" rx="2" />
          <path d="M62 118c20-4 26-14 30-22-14 2-22 8-30 22Z" />
          <path d="M58 124c-18-2-26-8-32-16 10 0 20 4 32 16Z" />
          <ellipse cx="60" cy="140" rx="20" ry="6" opacity=".25" />
        </g>
      </svg>
    );
  }

  if (variant === "daisy") {
    return (
      <svg viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">
        <g fill={color}>
          <circle cx="60" cy="50" r="10" />
          {[...Array(8)].map((_, i) => {
            const a = (i * Math.PI) / 4;
            const x = 60 + Math.cos(a) * 22;
            const y = 50 + Math.sin(a) * 22;
            return <circle key={i} cx={x} cy={y} r="9" opacity=".92" />;
          })}
          <rect x="58" y="74" width="4" height="56" rx="2" />
          <path d="M62 104c20-6 26-14 30-22-14 4-22 10-30 22Z" />
          <path d="M58 118c-18-2-26-8-32-16 10 0 20 4 32 16Z" />
          <ellipse cx="60" cy="142" rx="22" ry="6" opacity=".25" />
        </g>
      </svg>
    );
  }

  // rose (pixel)
  return <PixelRose size={120} color={color} />;
}

/* ========= Componente principal ========= */
export default function GardenOverlay() {
  const { data, isLoading, error, mutate } = useSWR<FlowersResponse>(
    "/api/flowers",
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: true }
  );

  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const flowers = data?.flowers ?? [];
  const last = flowers.slice(0, 8);

  const isWilted = (f: Flower): boolean =>
    typeof (f as Record<string, unknown>).wilted === "boolean"
      ? ((f as Record<string, unknown>).wilted as boolean)
      : false;

  // Posición aleatoria en anillo
  const pickPos = () => {
    const r = 3 + Math.random() * 9;
    const a = Math.random() * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r] as const;
  };

  // Selector (solo UI)
  const [idx, setIdx] = useState(0);
  const variant = useMemo<Variant>(() => VARIANTS[idx]!, [idx]);

  async function plant(messageFromUI: string) {
    if (pending) return;
    setErrMsg(null);

    const message = messageFromUI.trim().slice(0, 140) || undefined;

    setPending(true);
    setMsg("");

    const [px, py, pz] = pickPos();
    const optimistic: Flower = {
      id: `temp-${Date.now()}`,
      message: message ?? null,
      color: null,
      created_at: new Date().toISOString(),
      x: px,
      y: py,
      z: pz,
      family: variant, // importante para que aparezca con forma correcta
    };

    try {
      await mutate(
        async (current?: FlowersResponse): Promise<FlowersResponse> => {
          const res = await fetch("/api/flowers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Enviamos ambos por compatibilidad del backend:
            body: JSON.stringify({
              message,
              x: px,
              y: py,
              z: pz,
              family: variant,
              variant,
            }),
          });

          let apiError = `HTTP ${res.status}`;
          let json: unknown = null;
          try {
            json = await res.json();
            if (isRecord(json) && typeof json.error === "string") {
              apiError = json.error;
            }
          } catch {
            /* ignore */
          }

          if (!res.ok) throw new Error(apiError);

          const real: unknown = isRecord(json) ? json.flower : null;
          const ok =
            isRecord(real) &&
            typeof real.id === "string" &&
            "created_at" in real;

          const withPos: Flower | null = ok
            ? ({
                ...(real as Record<string, unknown>),
                x: px,
                y: py,
                z: pz,
              } as Flower)
            : null;

          const prev = current?.flowers ?? [];
          const next = [withPos, ...prev].filter(Boolean) as Flower[];
          return { flowers: next };
        },
        {
          optimisticData: { flowers: [optimistic, ...(data?.flowers ?? [])] },
          rollbackOnError: true,
          revalidate: true,
          populateCache: (result, current) => {
            const posById = new Map(
              (current?.flowers ?? []).map((f) => [
                f.id,
                { x: f.x, y: f.y, z: f.z },
              ])
            );
            return {
              flowers: (result?.flowers ?? []).map((f) => {
                const p = posById.get(f.id);
                return p ? ({ ...f, ...p } as Flower) : f;
              }),
            };
          },
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

  return (
    <div className="garden-overlay" aria-live="polite">
      <div className="col-left">
        {/* Panel: últimas flores */}
        <div className="panel panel-thin">
          <div className="panel-title">
            Últimas flores {isLoading ? "…" : `(${flowers.length})`}
          </div>

          {error && (
            <div role="alert" className="mt-8" style={{ color: "#ffadad" }}>
              No se pudieron cargar las flores.
            </div>
          )}

          <ul className="list list-compact" aria-busy={isLoading}>
            {last.length === 0 && !isLoading && (
              <li className="item muted">Aún no hay flores plantadas.</li>
            )}
            {last.map((f) => (
              <li key={f.id} className="item">
                <span className={`dot ${isWilted(f) ? "wilted" : "alive"}`} />
                <span className="msg">
                  {f.message ? (
                    f.message
                  ) : (
                    <em className="muted">Sin mensaje</em>
                  )}
                </span>
                <time className="ts">
                  {f.created_at
                    ? new Date(f.created_at).toLocaleString(undefined, {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </time>
              </li>
            ))}
          </ul>
        </div>

        {/* Panel: plantar (abajo-izq) */}
        <form
          className="panel panel-plant"
          onSubmit={onSubmit}
          aria-busy={pending}
        >
          <div className="panel-title">Plantar una flor</div>
          <div className="row">
            <label htmlFor="plant-msg" className="sr-only">
              Mensaje (opcional, 140 máx.)
            </label>
            <input
              id="plant-msg"
              name="message"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder="Mensaje (opcional, máx. 140)"
              maxLength={140}
              className="input input-sm"
              autoComplete="off"
              disabled={pending}
            />
            <button
              type="submit"
              className="btn btn-sm"
              aria-disabled={pending}
              disabled={pending}
              title="Plantar una flor"
            >
              {pending ? "Plantando…" : "Plantar"}
            </button>
          </div>
          {errMsg && (
            <div role="alert" className="mt-16" style={{ color: "#ffadad" }}>
              {errMsg}
            </div>
          )}
        </form>
      </div>

      {/* Selector flotante centro-inferior */}
      <div className="picker-floating" role="group" aria-label="Elegir flor">
        <button
          type="button"
          className="picker-arrow"
          aria-label="Flor anterior"
          onClick={() =>
            setIdx((p) => (p - 1 + VARIANTS.length) % VARIANTS.length)
          }
          title="Anterior"
          disabled={pending}
        >
          ←
        </button>

        <div className="picker-card" aria-live="polite">
          <FlowerPreview variant={variant} />
        </div>

        <button
          type="button"
          className="picker-arrow"
          aria-label="Siguiente flor"
          onClick={() => setIdx((p) => (p + 1) % VARIANTS.length)}
          title="Siguiente"
          disabled={pending}
        >
          →
        </button>

        <button
          type="button"
          className="btn btn-sm picker-cta"
          onClick={() => plant(msg)}
          disabled={pending}
          aria-disabled={pending}
          title="Plantar"
        >
          Plantar
        </button>
      </div>

      <style jsx>{`
        .picker-floating {
          position: absolute;
          left: 50%;
          bottom: calc(18px + var(--sa-b));
          transform: translateX(-50%);
          display: grid;
          grid-auto-flow: column;
          align-items: center;
          gap: 10px;
          pointer-events: auto;
          z-index: 12;
        }
        .picker-card {
          width: clamp(220px, 34vw, 360px);
          height: clamp(140px, 22vw, 220px);
          display: grid;
          place-items: center;
          background: color-mix(in oklab, var(--bg) 92%, white 8%);
          border: 1px solid color-mix(in oklab, var(--border) 90%, white 10%);
          border-radius: var(--radius);
          backdrop-filter: blur(6px) saturate(1.05);
          -webkit-backdrop-filter: blur(6px) saturate(1.05);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
        }
        .picker-arrow {
          appearance: none;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: rgba(255, 255, 255, 0.9);
          width: 44px;
          height: 44px;
          border-radius: 12px;
          cursor: pointer;
          line-height: 1;
        }
        .picker-arrow:hover {
          background: rgba(0, 0, 0, 0.35);
        }
        .picker-arrow:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .picker-cta {
          margin-left: 4px;
        }

        @media (max-width: 920px) {
          .picker-floating {
            bottom: calc(12px + var(--sa-b));
            gap: 8px;
          }
          .picker-card {
            width: min(72vw, 360px);
            height: min(44vw, 220px);
          }
        }
      `}</style>
    </div>
  );
}
