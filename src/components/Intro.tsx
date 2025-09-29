// app/components/Intro.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

type CSSVars = React.CSSProperties & { ["--fade-ms"]?: string };
type Props = { onStart: () => void };

export default function Intro({ onStart }: Props) {
  const [phase, setPhase] = useState<0 | 1>(0); // 0: "Antes de entrar…", 1: "Esperá un minuto…"
  const continueBtnRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Enfocar el botón principal al montar para navegación con teclado
  useEffect(() => {
    continueBtnRef.current?.focus();
  }, []);

  // Teclas Enter / Space también continúan (si el foco no está en un campo editable)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (isEditable) return;

      if (e.key === "Enter" || e.key === " ") {
        if (e.key === " ") e.preventDefault(); // evita scroll con Space
        handleContinue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transición automática al segundo mensaje (respeta reduced-motion con el mismo contenido pero sin animaciones)
  useEffect(() => {
    const t = window.setTimeout(() => setPhase(1), 1400);
    return () => window.clearTimeout(t);
  }, []);

  const handleContinue = () => {
    // leve protección ante doble disparo
    if (!continueBtnRef.current?.disabled) {
      continueBtnRef.current!.disabled = true;
      onStart();
    }
  };

  const style: CSSVars = { ["--fade-ms"]: "900ms" };

  const text = useMemo(
    () =>
      phase === 0
        ? "Antes de entrar…"
        : "Esperá un minuto en memoria de lo que ya no está",
    [phase]
  );

  return (
    <section
      ref={sectionRef}
      className="screen screen-portal place-items-center intro-root"
      role="region"
      aria-labelledby="intro-title"
      aria-describedby="intro-desc"
      style={style}
    >
      {/* Fondo decorativo */}
      <div aria-hidden="true" className="clouds" />
      <div aria-hidden="true" className="halo" />

      {/* Título accesible sincronizado con el texto actual */}
      <h1 id="intro-title" className="sr-only">
        {text}
      </h1>

      {/* Mensaje de fase anunciado de forma discreta a lectores de pantalla */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {text}
      </span>

      {/* Bloque central */}
      <div className="portal-text" style={{ zIndex: 3, textAlign: "center" }}>
        <p
          id="intro-desc"
          key={phase} // fuerza re-mount para animar al cambiar
          className="portal-sub fade-in-600"
          style={{
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
          ref={continueBtnRef}
          type="button"
          className="btn-portal mt-16"
          onClick={handleContinue}
          aria-label="Continuar al ritual de un minuto"
        >
          CONTINUAR
        </button>
      </div>

      {/* Fallback sin JS */}
      <noscript>
        <div
          className="intro-card"
          style={{
            background: "rgba(0,0,0,.35)",
            borderRadius: "14px",
            padding: "16px",
          }}
        >
          <p className="muted">
            Para vivir este ritual interactivo necesitás habilitar JavaScript.
          </p>
        </div>
      </noscript>
    </section>
  );
}
