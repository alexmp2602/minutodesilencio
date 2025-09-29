// app/components/GardenOverlay.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";

type FlowersResponse = { flowers: Flower[] };

const VARIANTS = ["rose", "tulip", "daisy"] as const;
type Variant = (typeof VARIANTS)[number];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/* ---------- ícono ultra-liviano del selector ---------- */
function VariantIcon({ v }: { v: Variant }) {
  if (v === "tulip") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 3c2 3 5 3 5 7a5 5 0 0 1-10 0c0-4 3-4 5-7Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (v === "daisy") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="2.2" fill="currentColor" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <circle
              key={i}
              cx={12 + Math.cos(a) * 5.6}
              cy={12 + Math.sin(a) * 5.6}
              r="2.1"
              fill="currentColor"
            />
          );
        })}
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 6c3.2 0 5.8 2 5.8 4.5S15.2 15 12 15 6.2 13 6.2 10.5 8.8 6 12 6Z"
        fill="currentColor"
      />
    </svg>
  );
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

  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  const flowers = data?.flowers ?? [];
  const total = flowers.length;

  const [idx, setIdx] = React.useState(0);
  const variant = VARIANTS[idx]!;

  // Pos aleatoria local
  const pickPos = () => {
    const r = 3 + Math.random() * 9;
    const a = Math.random() * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r] as const;
  };

  async function plant(messageFromUI: string) {
    if (pending) return;
    setErrMsg(null);

    const message = messageFromUI.trim().slice(0, 140) || undefined;
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

    setPending(true);
    setMsg("");

    try {
      await mutate(
        async (current?: FlowersResponse): Promise<FlowersResponse> => {
          const res = await fetch("/api/flowers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, x: px, y: py, z: pz, variant }),
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

  return (
    <div className="garden-overlay" aria-live="polite">
      {/* Chip contador (arriba-izq) */}
      <div className="counter-chip" title="Cantidad total de flores">
        Últimas flores: <strong>{isLoading ? "…" : total}</strong>
      </div>

      {/* Panel plantar — SIEMPRE centrado y de ancho fluido */}
      <form
        className="panel panel-plant plant-bar"
        onSubmit={onSubmit}
        aria-busy={pending}
      >
        <div className="panel-title">Plantar una flor</div>

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

          {/* Selector compacto con flechas pegadas a la flor */}
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
              ←
            </button>

            <div
              className="picker-current"
              title={labelFor(variant)}
              aria-live="polite"
            >
              <VariantIcon v={variant} />
            </div>

            <button
              type="button"
              className="picker-btn"
              onClick={() => setIdx((i) => (i + 1) % VARIANTS.length)}
              aria-label="Siguiente"
              disabled={pending}
            >
              →
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

        /* Barra plantar centrada y fluida */
        .plant-bar {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: max(12px, calc(12px + var(--sa-b)));
          width: min(880px, calc(100vw - 24px - var(--sa-l) - var(--sa-r)));
          pointer-events: auto;
        }

        .plant-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          align-items: center;
        }

        .input-grow {
          min-width: 0; /* evita overflow en móviles */
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

        /* Ajustes específicos mobile: mismo layout y centrado */
        @media (max-width: 560px) {
          .plant-row {
            grid-template-columns: 1fr auto auto;
            gap: 8px;
          }
          .picker,
          .picker-btn,
          .picker-current {
            border-radius: 10px;
          }
          .picker-btn,
          .picker-current {
            width: 34px;
            height: 34px;
          }
        }
        /* Solo placeholder más chico en pantallas móviles */
        @media (max-width: 560px) {
          .panel-plant .input::placeholder {
            font-size: 12px;
          }
          /* Prefijos por compatibilidad */
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

/* helpers */
function labelFor(v: Variant) {
  if (v === "tulip") return "Tulipán";
  if (v === "daisy") return "Margarita";
  return "Rosa";
}
