// src/components/TextOverlay.tsx
"use client";

import React from "react";
import TI from "@/components/ui/TablerIcon";

type Props = {
  /** 0..1 progreso de la intro del cielo (anima el texto) */
  progress: number;
  /** Mensajes a mostrar (se auto-distribuyen en la línea de tiempo) */
  lines?: string[];
};

/**
 * Overlay de texto puro (sin fondos). No crea scroll ni bloquea interacción.
 * Cormorant Garamond, glow leve y deslizamiento vertical suave.
 * Incluye un "scroll hint" (chevron) abajo-centro, contrastado.
 */
export default function TextOverlay({
  progress,
  lines = [
    "En memoria de lo que ya no está presente.",
    "Esperemos un minuto de silencio.",
  ],
}: Props) {
  const steps = buildWindows(lines.length, { overlap: 0.25 });

  // Mostrar pista solo al inicio (antes de scrollear) y si no hay reduced motion
  const [reducedMotion, setReducedMotion] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const upd = () => setReducedMotion(mq.matches);
    upd();
    mq.addEventListener?.("change", upd);
    return () => mq.removeEventListener?.("change", upd);
  }, []);
  const showHint = !reducedMotion && progress < 0.02; // oculto apenas se mueve

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2, // encima del canvas y del SkyOverlay
        pointerEvents: "none",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ position: "relative", width: "min(900px, 92vw)" }}>
        {lines.map((text, i) => {
          const w = steps[i];
          const k = windowed(progress, w.start, w.end); // 0..1 en su ventana
          let o = fadeInOut(k); // 0..1 suavizado
          let ty = lerp(18, -26, easeInOut(k));

          // La primera línea aparece desde el inicio (evita “pantalla vacía”)
          if (i === 0 && progress < 0.02) {
            o = 1;
            ty = 0;
          }

          return (
            <div
              key={i}
              className="font-serif"
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                fontStyle: "italic",
                fontSize: "clamp(18px, 2.4vw, 28px)",
                color: "var(--blue-french)",
                textAlign: "center",
                paddingInline: 8,
                textShadow:
                  "0 1px 2px rgba(0,0,0,.22), 0 0 10px rgba(255,255,255,.32)",
                opacity: o,
                transform: `translateY(${ty}px)`,
                transition: "opacity .14s linear, transform .14s linear",
                willChange: "opacity, transform",
              }}
            >
              {text}
            </div>
          );
        })}
      </div>

      {/* Scroll hint — abajo-centro, con más contraste */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "max(18px, calc(18px + var(--sa-b)))",
          transform: "translateX(-50%)",
          opacity: showHint ? 1 : 0,
          transition: "opacity .18s ease",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "grid",
            placeItems: "center",
            width: 44,
            height: 44,
            borderRadius: 999,
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(35,0,255,0.22)", // borde azul suave
            boxShadow:
              "0 10px 26px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.14), 0 0 0 4px rgba(255,255,255,0.35) inset",
            backdropFilter: "blur(6px) saturate(1.02)",
            WebkitBackdropFilter: "blur(6px) saturate(1.02)",
            animation: showHint
              ? "mds-float 1.6s ease-in-out infinite"
              : "none",
          }}
        >
          <TI
            name="chev-down"
            size={22}
            stroke={2.25}
            title="Deslizá hacia abajo"
            style={{
              color: "#2300ff", // 💙 azul de la paleta
              filter: "drop-shadow(0 1px 0 rgba(255,255,255,.6))",
            }}
          />
        </div>
      </div>

      {/* keyframes locales */}
      <style jsx>{`
        @keyframes mds-float {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(7px);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/** Distribuye N líneas a lo largo de la intro con un solapamiento configurable */
function buildWindows(
  n: number,
  opts: { overlap?: number } = {}
): Array<{ start: number; end: number }> {
  const overlap = clamp01(opts.overlap ?? 0.2); // fracción de solapamiento entre ventanas
  if (n <= 0) return [];
  if (n === 1) return [{ start: 0.0, end: 0.8 }];

  const span = 0.85; // porción útil de la intro
  const step = span / n;
  const ov = step * overlap;

  const out: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < n; i++) {
    const s = 0.0 + i * step - ov * 0.5;
    const e = 0.0 + (i + 1) * step + ov * 0.5;
    out.push({ start: clamp01(s), end: clamp01(e) });
  }
  return out;
}

// easing/helpers
function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function windowed(p: number, a: number, b: number) {
  if (b <= a) return 1;
  return clamp01((p - a) / (b - a));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeInOut(t: number) {
  const u = clamp01(t);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}
function fadeInOut(t: number) {
  // entrada y salida suaves
  const fIn = clamp01(t / 0.22);
  const fOut = clamp01((1 - t) / 0.28);
  return fIn * fOut;
}
