"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";

type FlowersResponse = { flowers: Flower[] };

export default function GardenOverlay() {
  const { data, isLoading, error, mutate } = useSWR<FlowersResponse>(
    "/api/flowers",
    fetcher,
    { revalidateOnFocus: false }
  );

  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const flowers: Flower[] = data?.flowers ?? [];
  const last: Flower[] = flowers.slice(0, 8);

  async function onPlant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrMsg(null);

    const message = msg.trim().slice(0, 140) || undefined;
    setPending(true);
    setMsg("");

    const pickPos = () => {
      const r = 3 + Math.random() * 9;
      const a = Math.random() * Math.PI * 2;
      return [Math.cos(a) * r, 0, Math.sin(a) * r] as const;
    };
    const [px, py, pz] = pickPos();

    const optimistic: Flower = {
      id: `temp-${Date.now()}`,
      message: message ?? null,
      created_at: new Date().toISOString(),
      x: px,
      y: py,
      z: pz,
    };

    try {
      await mutate(
        async (current?: { flowers: Flower[] }) => {
          const res = await fetch("/api/flowers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, x: px, y: py, z: pz }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error ?? "Error al plantar");

          const real: Flower | null = json?.flower ?? null;
          const realWithPos = real
            ? ({ ...real, x: px, y: py, z: pz } as Flower)
            : null;

          const prev = current?.flowers ?? [];
          const next = [realWithPos, ...prev].filter(Boolean) as Flower[];
          return { flowers: next };
        },
        {
          optimisticData: { flowers: [optimistic, ...(data?.flowers ?? [])] },
          rollbackOnError: true,
          revalidate: true,
          populateCache: (
            result: { flowers: Flower[] },
            current?: { flowers: Flower[] }
          ) => {
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

  // util: lee "wilted" si existe (no usamos any)
  const isWilted = (f: Flower): boolean => {
    const rec = f as Record<string, unknown>;
    return typeof rec.wilted === "boolean" ? (rec.wilted as boolean) : false;
  };

  return (
    <div className="garden-overlay" aria-live="polite">
      {/* Panel izquierdo: plantar */}
      <form className="panel" onSubmit={onPlant} aria-busy={pending}>
        <div className="panel-title">Plantar una flor</div>

        <div className="row">
          <label htmlFor="plant-msg" className="sr-only">
            Mensaje (opcional, 140 máx.)
          </label>
          <input
            id="plant-msg"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Mensaje (opcional, máx. 140)"
            maxLength={140}
            className="input"
            autoComplete="off"
            disabled={pending}
          />
          <button className="btn" aria-disabled={pending} disabled={pending}>
            {pending ? "Plantando…" : "Plantar"}
          </button>
        </div>

        <div className="hint">
          Tu mensaje aparecerá sobre una flor. También podés plantar en
          silencio.
        </div>

        {errMsg && (
          <div role="alert" className="mt-16" style={{ color: "#ffadad" }}>
            {errMsg}
          </div>
        )}
      </form>

      {/* Panel derecho: últimas flores */}
      <div className="panel">
        <div className="panel-title">
          Últimas flores {isLoading ? "…" : `(${flowers.length})`}
        </div>

        {error && (
          <div role="alert" className="mt-8" style={{ color: "#ffadad" }}>
            No se pudieron cargar las flores.
          </div>
        )}

        <ul className="list">
          {last.length === 0 && !isLoading && (
            <li className="item muted">Aún no hay flores plantadas.</li>
          )}

          {last.map((f) => (
            <li key={f.id} className="item">
              <span className={`dot ${isWilted(f) ? "wilted" : "alive"}`} />
              <span className="msg">
                {f.message ? f.message : <em className="muted">Sin mensaje</em>}
              </span>
              <time className="ts">
                {f.created_at ? new Date(f.created_at).toLocaleString() : "—"}
              </time>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
