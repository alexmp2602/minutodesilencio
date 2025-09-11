"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Flower } from "@/lib/types";

type FlowersResponse = { ok: boolean; flowers: Flower[] };

export default function GardenOverlay() {
  const { data, isLoading, error } = useSWR<FlowersResponse>(
    "/api/flowers",
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState("");

  async function onPlant(e: React.FormEvent) {
    e.preventDefault();
    const message = msg.trim().slice(0, 140);
    if (!message) return;

    try {
      setPending(true);
      const res = await fetch("/api/flowers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Error al plantar");

      setMsg("");
      await mutate("/api/flowers");
    } catch (err) {
      console.error(err);
    } finally {
      setPending(false);
    }
  }

  const flowers: Flower[] = data?.flowers ?? [];
  const last: Flower[] = flowers.slice(0, 8);

  return (
    <div className="garden-overlay">
      {/* Panel izquierdo: plantar */}
      <form className="panel" onSubmit={onPlant}>
        <div className="panel-title">Plantar una flor</div>
        <div className="row">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Mensaje (opcional, máx. 140)"
            maxLength={140}
            className="input"
          />
          <button className="btn" disabled={pending || msg.trim().length === 0}>
            {pending ? "Plantando…" : "Plantar"}
          </button>
        </div>
        <div className="hint">
          Tu mensaje aparecerá sobre una flor. Podés plantar en silencio si lo
          dejás vacío.
        </div>
      </form>

      {/* Panel derecho: últimas flores */}
      <div className="panel">
        <div className="panel-title">
          Últimas flores {isLoading ? "…" : `(${flowers.length})`}
        </div>
        {error && <div className="err">No se pudieron cargar las flores.</div>}
        <ul className="list">
          {last.length === 0 && !isLoading && (
            <li className="item muted">Aún no hay flores plantadas.</li>
          )}
          {last.map((f: Flower) => (
            <li key={f.id} className="item">
              <span className={`dot ${f.wilted ? "wilted" : "alive"}`} />
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
