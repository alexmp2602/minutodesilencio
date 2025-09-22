// app/components/GardenOverlay.tsx
"use client";

import * as React from "react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";

type FlowersResponse = { flowers: Flower[] };

const VARIANTS = ["rose", "tulip", "daisy"] as const;
type Variant = (typeof VARIANTS)[number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/* ---------- Previews muy livianos ---------- */
function PixelRose({ size = 72, color = "#E4B8FF" }) {
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
  const w = rows[0].length;
  const h = rows.length;
  const pad = 6;
  const dotR = 0.9;
  const dots: JSX.Element[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rows[y][x] === "1")
        dots.push(
          <circle
            key={`${x}-${y}`}
            cx={x + pad}
            cy={y + pad}
            r={dotR}
            fill={color}
          />
        );
    }
  }
  return (
    <svg
      viewBox={`0 0 ${w + pad * 2} ${h + pad * 2}`}
      width={size}
      height={(size * (h + pad * 2)) / (w + pad * 2)}
    >
      {dots}
      <g fill={color} opacity={0.9}>
        <rect
          x={(w + pad * 2) / 2 - 0.6}
          y={pad + h * 0.55}
          width={1.2}
          height={h * 0.28}
          rx={0.6}
        />
        <ellipse
          cx={(w + pad * 2) / 2}
          cy={pad + h * 0.92}
          rx={3.6}
          ry={1.2}
          opacity=".25"
        />
      </g>
    </svg>
  );
}
function Tulip({ size = 72, color = "#E4B8FF" }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <g fill={color}>
        <path d="M60 26c10 14 22 14 22 30 0 14-10 24-22 24s-22-10-22-24c0-16 12-16 22-30Z" />
        <rect x="58" y="74" width="4" height="38" rx="2" />
        <path d="M62 94c18-4 24-12 28-20-14 2-20 8-28 20Z" />
        <path d="M58 100c-16-2-24-8-30-14 10 0 18 4 30 14Z" />
      </g>
    </svg>
  );
}
function Daisy({ size = 72, color = "#E4B8FF" }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <g fill={color}>
        <circle cx="60" cy="36" r="9" />
        {[...Array(8)].map((_, i) => {
          const a = (i * Math.PI) / 4;
          const x = 60 + Math.cos(a) * 18;
          const y = 36 + Math.sin(a) * 18;
          return <circle key={i} cx={x} cy={y} r="8" opacity=".92" />;
        })}
        <rect x="58" y="56" width="4" height="46" rx="2" />
      </g>
    </svg>
  );
}
function Preview({ variant, size = 72 }: { variant: Variant; size?: number }) {
  if (variant === "tulip") return <Tulip size={size} />;
  if (variant === "daisy") return <Daisy size={size} />;
  return <PixelRose size={size} />;
}

/* ---------- Overlay principal ---------- */
export default function GardenOverlay() {
  const { data, isLoading, error, mutate } = useSWR<FlowersResponse>(
    "/api/flowers",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const flowers = data?.flowers ?? [];
  const total = flowers.length;

  // selector radial
  const [idx, setIdx] = useState(0);
  const variant = useMemo<Variant>(() => VARIANTS[idx]!, [idx]);

  // pos aleatoria (cliente)
  const pickPos = () => {
    const r = 3 + Math.random() * 9;
    const a = Math.random() * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r] as const;
  };

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
      family: variant,
    };

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
              family: variant,
              variant,
            }),
          });

          let apiError = `HTTP ${res.status}`;
          let json: unknown = null;
          try {
            json = await res.json();
            if (isRecord(json) && typeof json.error === "string")
              apiError = json.error;
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
      {/* -------- contador chiquito arriba-izq -------- */}
      <div className="counter-chip" title="Cantidad total de flores">
        Últimas flores: <strong>{isLoading ? "…" : total}</strong>
      </div>

      {/* -------- panel plantar (abajo-izq) -------- */}
      <form
        className="panel panel-plant"
        onSubmit={onSubmit}
        aria-busy={pending}
      >
        <div className="panel-title">Plantar</div>
        <div className="row">
          <label htmlFor="plant-msg" className="sr-only">
            Mensaje (opcional, 140 máx.)
          </label>
          <input
            id="plant-msg"
            name="message"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Escribí un mensaje (opcional, máx. 140)"
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

      {/* -------- selector radial (abajo-der) -------- */}
      <RadialPicker
        selected={idx}
        setSelected={(i) => setIdx(i)}
        disabled={pending}
        renderIcon={(i) => <Preview variant={VARIANTS[i]!} size={36} />}
        labels={["Rosa", "Tulipán", "Margarita"]}
      />

      {/* estilos locales del overlay (cosas que no están en globals.css) */}
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
      `}</style>
    </div>
  );
}

/* ---------- Selector radial (¼ círculo) ---------- */
function RadialPicker({
  selected,
  setSelected,
  disabled,
  renderIcon,
  labels,
}: {
  selected: number;
  setSelected: (n: number) => void;
  disabled?: boolean;
  renderIcon: (i: number) => React.ReactNode;
  labels: string[];
}) {
  const R = 180; // radio del cuarto de círculo
  const cx = R;
  const cy = R;
  const slices = 3;
  const step = Math.PI / 2 / slices; // 90° / 3
  const start0 = Math.PI; // desde la izquierda hacia arriba

  const paths = Array.from({ length: slices }, (_, i) => {
    const a0 = start0 + i * step;
    const a1 = a0 + step;
    const p0 = { x: cx + R * Math.cos(a0), y: cy + R * Math.sin(a0) };
    const p1 = { x: cx + R * Math.cos(a1), y: cy + R * Math.sin(a1) };
    const d = `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${p1.x} ${p1.y} Z`;
    const midA = (a0 + a1) / 2;
    const ix = cx + R * 0.62 * Math.cos(midA);
    const iy = cy + R * 0.62 * Math.sin(midA);
    return { d, ix, iy };
  });

  return (
    <div className="radial">
      <svg
        viewBox={`0 0 ${R} ${R}`}
        width={R}
        height={R}
        aria-label="Elegir flor"
        // ❌ evitamos el borde blanco de focus
        tabIndex={-1}
      >
        <defs>
          <filter
            id="radial-shadow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feDropShadow
              dx="0"
              dy="4"
              stdDeviation="6"
              floodColor="black"
              floodOpacity="0.35"
            />
          </filter>
        </defs>

        {/* base del cuarto de círculo */}
        <path
          d={`M ${cx} ${cy} L 0 ${cy} A ${R} ${R} 0 0 1 ${cx} 0 Z`}
          fill="rgba(14,16,18,0.78)"
          stroke="rgba(255,255,255,0.12)"
          filter="url(#radial-shadow)"
        />

        {paths.map((p, i) => (
          <g key={i} className={`slice ${i === selected ? "on" : ""}`}>
            <path
              d={p.d}
              fill={i === selected ? "rgba(255,255,255,0.12)" : "transparent"}
              stroke="rgba(255,255,255,0.12)"
              onClick={() => !disabled && setSelected(i)}
              role="button"
              aria-label={labels[i]}
              aria-pressed={i === selected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setSelected(i);
              }}
            />
            {/* Ícono dentro del SVG (sin foreignObject) */}
            <g transform={`translate(${p.ix - 18}, ${p.iy - 18})`}>
              <g className="icon">{renderIcon(i)}</g>
            </g>
          </g>
        ))}
      </svg>

      <style jsx>{`
        .radial {
          position: absolute;
          right: calc(8px + var(--sa-r));
          bottom: calc(8px + var(--sa-b));
          pointer-events: auto;
          user-select: none;
        }
        /* nada de rectángulo blanco */
        .radial :global(svg),
        .radial :global(svg:focus),
        .radial :global(svg:focus-visible),
        .radial :global(svg *:focus) {
          outline: none !important;
        }
        .slice path {
          cursor: pointer;
          transition: fill 160ms var(--easing), stroke 160ms var(--easing);
        }
        .slice:hover path {
          fill: rgba(255, 255, 255, 0.08);
        }
        /* Focus accesible sin borde rectangular */
        .slice path:focus-visible {
          stroke: rgba(255, 255, 255, 0.6);
          stroke-width: 2;
        }
        .slice.on path {
          fill: rgba(255, 255, 255, 0.12);
        }
        .icon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          pointer-events: none; /* para no robar clicks */
        }
        @media (max-width: 720px) {
          :global(.radial svg) {
            width: 140px !important;
            height: 140px !important;
          }
        }
      `}</style>
    </div>
  );
}
