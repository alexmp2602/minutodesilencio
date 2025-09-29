// app/components/Ritual.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";

/** Duración del ritual (segundos) */
const TOTAL_SEC = 60 as const;

/** Mensajes por tramos */
const SEGMENTS = [
  {
    to: 12,
    title: "Preparación…",
    text: "Tomá un instante para estar presente.",
  },
  { to: 26, title: "Respirá…", text: "Inhalá y exhalá con calma." },
  { to: 44, title: "Recordá…", text: "Pensá en lo que querés despedir." },
  { to: 60, title: "Silencio…", text: "Guardemos silencio juntos." },
] as const;

/** Tamaño base del SVG de la vela (se adapta en móvil) */
const SVG_SIZE = 360;

export default function Ritual({ onComplete }: { onComplete: () => void }) {
  // Mantener la callback estable aunque el padre re-renderice
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  /** Timer preciso basado en performance.now() */
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (startRef.current === null) startRef.current = performance.now();

    const tick = (now: number) => {
      const ms = Math.min(now - startRef.current!, TOTAL_SEC * 1000);
      setElapsedMs(ms);

      if (ms >= TOTAL_SEC * 1000) {
        if (!doneRef.current) {
          doneRef.current = true;
          onCompleteRef.current?.();
        }
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /** Accesos rápidos: Escape / S → saltar */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!doneRef.current) {
          doneRef.current = true;
          onCompleteRef.current?.();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const remainingSec = Math.max(0, TOTAL_SEC - elapsedSec);
  const progress = Math.min(elapsedMs / (TOTAL_SEC * 1000), 1);

  const segment = useMemo(
    () =>
      SEGMENTS.find((s) => elapsedSec < s.to) ?? SEGMENTS[SEGMENTS.length - 1],
    [elapsedSec]
  );

  /** Geometría de la vela (en función del tamaño del SVG) */
  const candleW = 140 * (SVG_SIZE / 420); // escalado del diseño original
  const candleH = 240 * (SVG_SIZE / 420);
  const topY = 150 * (SVG_SIZE / 420);
  const melt = progress * (candleH * 0.7);
  const waxY = topY + melt; // Y actual de la superficie de cera
  const visibleH = Math.max(16 * (SVG_SIZE / 420), candleH - melt);
  const flicker =
    1 + Math.sin(elapsedMs / 90) * 0.02 + Math.sin(elapsedMs / 333) * 0.015;

  const finished = progress >= 1;

  // Tamaño responsive del SVG (ligeramente más chico en móvil)
  const svgSide =
    typeof window !== "undefined" && window.innerWidth < 560
      ? Math.round(SVG_SIZE * 0.82)
      : SVG_SIZE;

  return (
    <section
      className="screen screen-portal place-items-center"
      aria-label="Un minuto de silencio"
      style={{
        /** 👇 evita que nada desborde (sin deshabilitar scroll global del sitio) */
        position: "relative",
        minHeight: "100svh",
        overflow: "hidden",
        paddingBlock: "clamp(12px, 5vh, 32px)",
      }}
    >
      {/* Fondo: cielo + nubes (acotado a viewport) */}
      <div
        aria-hidden="true"
        className="clouds"
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      />

      {/* Vignette para legibilidad sobre gradiente */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(1100px 680px at 50% 34%, rgba(0,0,0,.22) 0%, rgba(0,0,0,.20) 45%, rgba(0,0,0,.32) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Audio ambiente + botón mute */}
      <AmbientAudio src="/ambience-soft.mp3" volume={0.2} />
      <MuteButton />

      {/* Contador */}
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute",
          top: 14,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "clamp(18px, 2.6vw, 28px)",
          fontWeight: 800,
          color: "#fff",
          textShadow: "0 2px 10px rgba(0,0,0,.45)",
          letterSpacing: 0.2,
          zIndex: 2,
        }}
      >
        {remainingSec}s
      </div>

      {/* Contenedor central */}
      <div
        className="ritual-wrap"
        style={{
          width: "min(640px, 92vw)",
          gap: 10,
          alignSelf: "center",
          justifySelf: "center",
          display: "grid",
          justifyItems: "center",
          zIndex: 1,
        }}
      >
        {/* Vela centrada */}
        <div
          style={{
            position: "relative",
            width: svgSide,
            height: svgSide,
            maxWidth: "92vw",
            filter: "drop-shadow(0 14px 36px rgba(255, 232, 180, .24))",
          }}
          aria-hidden="true"
        >
          <svg
            width={svgSide}
            height={svgSide}
            viewBox="0 0 420 420"
            role="img"
            aria-label={finished ? "Vela apagada" : "Vela encendida"}
          >
            <defs>
              <radialGradient id="glow" cx="50%" cy="30%" r="60%">
                <stop offset="0%" stopColor="#fff8d6" stopOpacity="0.75" />
                <stop offset="60%" stopColor="#ffe8a6" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#ffd37a" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="wax" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5f0ea" />
                <stop offset="60%" stopColor="#e8e1d9" />
                <stop offset="100%" stopColor="#d7cfc6" />
              </linearGradient>
              <linearGradient id="wick" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3d2b23" />
                <stop offset="100%" stopColor="#120c09" />
              </linearGradient>
              <linearGradient id="flame" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff4c9" />
                <stop offset="45%" stopColor="#ffda7a" />
                <stop offset="65%" stopColor="#ff9f3a" />
                <stop offset="100%" stopColor="#ff7a1a" />
              </linearGradient>

              {/* La vela se “acorta” desde arriba con esta máscara */}
              <mask id="waxMask">
                <rect x="0" y="0" width="420" height="420" fill="black" />
                <rect
                  x={(420 - candleW) / 2}
                  y={waxY}
                  width={candleW}
                  height={visibleH}
                  rx="16"
                  ry="16"
                  fill="white"
                />
              </mask>
            </defs>

            {/* Glow cálido detrás de la llama */}
            {!finished && (
              <circle
                cx="210"
                cy={waxY - 20}
                r="118"
                fill="url(#glow)"
                opacity="0.85"
              />
            )}

            {/* Sombra base */}
            <ellipse
              cx="210"
              cy={topY + candleH + 36}
              rx="110"
              ry="14"
              fill="rgba(0,0,0,.28)"
            />

            {/* Cera (enmascarada) */}
            <g mask="url(#waxMask)">
              <rect
                x={(420 - candleW) / 2}
                y={topY}
                width={candleW}
                height={candleH}
                fill="url(#wax)"
                rx="18"
                ry="18"
                stroke="rgba(0,0,0,.22)"
                strokeWidth="0.6"
              />

              {/* Labio superior irregular */}
              <path
                d={`
                  M ${(420 - candleW) / 2} ${waxY + 10}
                  C ${210 - 40} ${waxY + 2}, ${210 + 40} ${waxY + 18}, ${
                  (420 + candleW) / 2
                } ${waxY + 6}
                  L ${(420 + candleW) / 2} ${waxY - 18}
                  C ${210 + 36} ${waxY - 10}, ${210 - 36} ${waxY - 6}, ${
                  (420 - candleW) / 2
                } ${waxY - 14}
                  Z
                `}
                fill="#efe8df"
                opacity="0.92"
              />

              {/* Gotas durante el minuto */}
              {progress > 0.38 && (
                <path
                  d={`M ${210 + candleW / 2 - 10} ${
                    topY + 78 + (progress - 0.38) * 130
                  }
                      c 7 10, -4 18, -9 22
                      c -4 -6, -6 -12, 9 -22 Z`}
                  fill="#efe8df"
                  opacity="0.9"
                />
              )}
              {progress > 0.58 && (
                <path
                  d={`M ${210 - candleW / 2 + 12} ${
                    topY + 104 + (progress - 0.58) * 100
                  }
                      c 6 10, -5 18, -9 22
                      c -3 -6, -5 -12, 9 -22 Z`}
                  fill="#efe8df"
                  opacity="0.9"
                />
              )}
            </g>

            {/* Pabilo y llama siguen a la superficie (waxY) */}
            <rect
              x="208"
              y={waxY - 8}
              width="4"
              height="16"
              fill="url(#wick)"
              rx="2"
            />

            {!finished ? (
              <>
                {/* Núcleo azulado */}
                <ellipse
                  cx="210"
                  cy={waxY - 18}
                  rx={8 * flicker}
                  ry={12 * flicker}
                  fill="#aee3ff"
                  opacity="0.95"
                />
                {/* Llama */}
                <path
                  d={`M210 ${waxY - 30} C 228 ${waxY - 10}, 222 ${
                    waxY + 10
                  }, 210 ${waxY + 30}
                      C 198 ${waxY + 10}, 192 ${waxY - 10}, 210 ${waxY - 30} Z`}
                  fill="url(#flame)"
                  style={{
                    transformOrigin: `210px ${waxY}px`,
                    transform: `scale(${flicker})`,
                  }}
                />
              </>
            ) : (
              <>
                <circle
                  cx="210"
                  cy={waxY - 22}
                  r="5"
                  fill="rgba(180,180,180,.9)"
                />
                <circle
                  cx="208"
                  cy={waxY - 34}
                  r="8"
                  fill="rgba(180,180,180,.6)"
                />
                <circle
                  cx="212"
                  cy={waxY - 50}
                  r="12"
                  fill="rgba(180,180,180,.35)"
                />
              </>
            )}
          </svg>
        </div>

        {/* Mensajes */}
        <div
          className="fade-in-600"
          aria-live="polite"
          style={{
            minHeight: 96,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          {!finished ? (
            <>
              <div
                style={{
                  fontSize: "clamp(18px, 3.2vw, 26px)",
                  fontWeight: 800,
                  color: "#fff",
                  textShadow: "0 2px 10px rgba(0,0,0,.5)",
                }}
              >
                {segment.title}
              </div>
              <div
                style={{
                  marginTop: 8,
                  color: "rgba(255,255,255,.95)",
                  lineHeight: 1.6,
                  textShadow: "0 2px 8px rgba(0,0,0,.45)",
                  fontSize: "clamp(14px, 2.1vw, 20px)",
                }}
              >
                {segment.text}
              </div>
            </>
          ) : (
            <>
              <div className="portal-title" style={{ color: "#fff" }}>
                El silencio terminó.
              </div>
              <div
                className="portal-sub"
                style={{ color: "#fff", marginTop: 6 }}
              >
                Podés entrar.
              </div>
            </>
          )}
        </div>

        {/* Botón Saltar */}
        {!finished && (
          <button
            type="button"
            className="skip-btn"
            onClick={() => {
              if (!doneRef.current) {
                doneRef.current = true;
                onCompleteRef.current?.();
              }
            }}
            aria-label="Saltar el minuto y pasar al jardín"
            title="Saltar"
            style={{
              position: "absolute",
              right: 14,
              bottom: 14,
              zIndex: 3,
              background: "rgba(255,255,255,.12)",
              border: "1px solid rgba(255,255,255,.18)",
              color: "#fff",
              borderRadius: 10,
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              backdropFilter: "blur(6px)",
            }}
          >
            ⏭
          </button>
        )}
      </div>
    </section>
  );
}
