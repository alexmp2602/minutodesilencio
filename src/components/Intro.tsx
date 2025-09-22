// app/components/Intro.tsx
"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import type React from "react";

type CSSVars = React.CSSProperties & { ["--fade-ms"]?: string };
type Props = { onStart: () => void };

export default function Intro({ onStart }: Props) {
  const { setStage } = useAppStore();
  const [phase, setPhase] = useState<0 | 1>(0); // 0: "Antes de entrar…", 1: "Esperá un minuto…"

  // Tecla Enter / Space también continúa
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  // Transición automática al segundo mensaje
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 1400);
    return () => clearTimeout(t);
  }, []);

  const style: CSSVars = { ["--fade-ms"]: "900ms" };

  const text =
    phase === 0
      ? "Antes de entrar…"
      : "Esperá un minuto en memoria de lo que ya no está";

  return (
    <section
      className="screen screen-portal place-items-center intro-root"
      role="region"
      aria-describedby="intro-desc"
      style={style}
    >
      {/* Fondo decorativo */}
      <div aria-hidden="true" className="clouds" />
      <div aria-hidden="true" className="halo" />

      {/* Título accesible (no visible) que se sincroniza con el texto actual */}
      <h1 id="intro-title" className="sr-only">
        {text}
      </h1>

      {/* Bloque central */}
      <div className="portal-text" style={{ zIndex: 3, textAlign: "center" }}>
        <p
          id="intro-desc"
          key={phase} // fuerza re-mount para animar al cambiar
          className="portal-sub fade-in-600"
          style={{
            // un leve glow para asegurar legibilidad sobre el halo
            textShadow:
              "0 1px 2px rgba(0,0,0,.25), 0 0 10px rgba(255,255,255,.35)",
            fontSize: "clamp(18px, 2.2vw, 26px)",
            marginInline: "auto",
            maxWidth: 820,
          }}
        >
          {text}
        </p>

        <button
          className="btn-portal mt-16"
          onClick={() => {
            setStage("ritual");
            onStart();
          }}
          aria-label="Continuar al ritual de un minuto"
        >
          CONTINUAR
        </button>
      </div>
    </section>
  );
}
