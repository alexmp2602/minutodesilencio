// app/components/Ritual.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";

const TOTAL_SEC = 60;
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

export default function Ritual({ onComplete }: { onComplete: () => void }) {
  const rafRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const ms = Math.min(now - start, TOTAL_SEC * 1000);
      setElapsedMs(ms);
      if (ms >= TOTAL_SEC * 1000) {
        onComplete();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onComplete]);

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const remainingSec = Math.max(0, TOTAL_SEC - elapsedSec);
  const progress = Math.min(elapsedMs / (TOTAL_SEC * 1000), 1);
  const segment = useMemo(
    () =>
      SEGMENTS.find((s) => elapsedSec < s.to) ?? SEGMENTS[SEGMENTS.length - 1],
    [elapsedSec]
  );

  /** --- Vela & llama (sincronizados con el derretido) --- */
  const candleW = 140;
  const candleH = 240;
  const topY = 150; // Y del borde superior original
  const melt = progress * (candleH * 0.7); // cuánto “baja” la superficie
  const waxY = topY + melt; // Y actual de la superficie de cera
  const visibleH = Math.max(16, candleH - melt);
  const flicker =
    1 + Math.sin(elapsedMs / 90) * 0.02 + Math.sin(elapsedMs / 333) * 0.015;
  const finished = progress >= 1;

  return (
    <section
      className="screen screen-portal place-items-center"
      aria-label="Un minuto de silencio"
    >
      {/* Cielo + halo */}
      <div aria-hidden="true" className="clouds" />

      {/* Vignette/oscurecido para legibilidad */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(1200px 800px at 50% 35%, rgba(0,0,0,.28) 0%, rgba(0,0,0,.24) 45%, rgba(0,0,0,.36) 100%)",
          pointerEvents: "none",
        }}
      />

      <AmbientAudio src="/ambience-soft.mp3" volume={0.22} />
      <MuteButton />

      {/* Contador simple (solo texto) */}
      <div
        aria-live="polite"
        style={{
          position: "absolute",
          top: 18,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 28,
          fontWeight: 700,
          color: "#fff",
          textShadow: "0 2px 10px rgba(0,0,0,.45)",
          letterSpacing: 0.2,
        }}
      >
        {remainingSec}s
      </div>

      <div
        className="ritual-wrap"
        style={{
          width: "min(680px, 92vw)",
          gap: 14,
          alignSelf: "center",
          justifySelf: "center",
        }}
      >
        {/* Vela centrada */}
        <div
          style={{
            position: "relative",
            width: 420,
            maxWidth: "92vw",
            display: "grid",
            justifyItems: "center",
            filter: "drop-shadow(0 16px 42px rgba(255, 232, 180, .28))",
          }}
          aria-hidden="true"
        >
          <svg
            width="420"
            height="420"
            viewBox="0 0 420 420"
            role="img"
            aria-label="Vela encendida"
          >
            <defs>
              <radialGradient id="glow" cx="50%" cy="30%" r="60%">
                <stop offset="0%" stopColor="#fff8d6" stopOpacity="0.78" />
                <stop offset="60%" stopColor="#ffe8a6" stopOpacity="0.28" />
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
                r="130"
                fill="url(#glow)"
                opacity="0.85"
              />
            )}

            {/* Sombra base */}
            <ellipse
              cx="210"
              cy={topY + candleH + 40}
              rx="120"
              ry="18"
              fill="rgba(0,0,0,.32)"
            />

            {/* Cera (enmascarada por waxMask) */}
            <g mask="url(#waxMask)">
              <rect
                x={(420 - candleW) / 2}
                y={topY}
                width={candleW}
                height={candleH}
                fill="url(#wax)"
                rx="18"
                ry="18"
                stroke="rgba(0,0,0,.25)"
                strokeWidth="0.6"
              />

              {/* Labio superior irregular = superficie actual de cera */}
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

              {/* Gotas que aparecen durante el minuto */}
              {progress > 0.35 && (
                <path
                  d={`M ${210 + candleW / 2 - 10} ${
                    topY + 80 + (progress - 0.35) * 140
                  }
                      c 7 10, -4 18, -9 22
                      c -4 -6, -6 -12, 9 -22 Z`}
                  fill="#efe8df"
                  opacity="0.92"
                />
              )}
              {progress > 0.55 && (
                <path
                  d={`M ${210 - candleW / 2 + 12} ${
                    topY + 110 + (progress - 0.55) * 110
                  }
                      c 6 10, -5 18, -9 22
                      c -3 -6, -5 -12, 9 -22 Z`}
                  fill="#efe8df"
                  opacity="0.92"
                />
              )}
            </g>

            {/* Pabilo y llama SIGUEN a la superficie (waxY) */}
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
                {/* Llama principal */}
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

        {/* Bloque de mensajes (único, sin solaparse) */}
        <div
          className="fade-in-600"
          aria-live="polite"
          style={{
            minHeight: 110,
            textAlign: "center",
            marginTop: 6,
          }}
        >
          {!finished ? (
            <>
              <div
                style={{
                  fontSize: "clamp(20px, 3.6vw, 28px)",
                  fontWeight: 800,
                  color: "#fff",
                  textShadow: "0 2px 12px rgba(0,0,0,.5)",
                }}
              >
                {segment.title}
              </div>
              <div
                style={{
                  marginTop: 10,
                  color: "rgba(255,255,255,.95)",
                  lineHeight: 1.65,
                  textShadow: "0 2px 10px rgba(0,0,0,.45)",
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
            onClick={onComplete}
            aria-label="Saltar el minuto y pasar al jardín"
            title="Saltar"
          >
            ⏭
          </button>
        )}
      </div>
    </section>
  );
}
