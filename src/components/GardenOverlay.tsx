"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";

type FlowersResponse = { flowers: Flower[] };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

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

  const isWilted = (f: Flower): boolean => {
    const r = f as Record<string, unknown>;
    return typeof r.wilted === "boolean" ? (r.wilted as boolean) : false;
  };

  const pickPos = () => {
    const r = 3 + Math.random() * 9;
    const a = Math.random() * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r] as const;
  };

  async function onPlant(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;

    setErrMsg(null);
    const message = msg.trim().slice(0, 140) || undefined;
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
    };

    try {
      await mutate(
        async (current?: FlowersResponse): Promise<FlowersResponse> => {
          const res = await fetch("/api/flowers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, x: px, y: py, z: pz }),
          });

          let apiError = `HTTP ${res.status}`;
          let json: unknown = null;
          try {
            json = await res.json();
            if (isRecord(json) && typeof json.error === "string") {
              apiError = json.error;
            }
          } catch {}

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

  return (
    <div className="garden-overlay" aria-live="polite">
      <div className="col-left">
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

        <form
          className="panel panel-plant"
          onSubmit={onPlant}
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
    </div>
  );
}
