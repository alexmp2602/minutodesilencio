// src/components/LoadingAuraProgress.tsx
"use client";

import React, { useEffect, useState } from "react";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export default function LoadingAuraProgress({ active }: { active: boolean }) {
  const [k, setK] = useState(0);

  // Escucha el progreso global del silencio mientras el loader está activo
  useEffect(() => {
    if (!active) {
      setK(0);
      return;
    }

    const onProgress = (e: Event) => {
      const detail = (e as CustomEvent).detail as { k?: number } | undefined;
      if (typeof detail?.k === "number") {
        setK(clamp01(detail.k));
      }
    };

    window.addEventListener("silence:progress", onProgress as EventListener);
    return () => {
      window.removeEventListener(
        "silence:progress",
        onProgress as EventListener
      );
    };
  }, [active]);

  if (!active) return null;

  const eased = easeOutCubic(k);

  // intensidad: 0 → casi nada, 1 → fuerte
  const opacity = 0.12 + eased * 0.9;
  const scale = 0.9 + eased * 0.3;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
        overflow: "hidden",
      }}
    >
      {/* capa de auras generales */}
      <div
        className="aura-layer"
        style={{
          opacity,
          transform: `scale(${scale})`,
        }}
      />

      {/* halo centrado sobre el área de la barra */}
      <div
        className="bar-halo"
        style={{
          opacity: 0.2 + eased * 0.8,
          transform: `translate(-50%, -50%) scale(${0.9 + eased * 0.4})`,
        }}
      />

      <style jsx>{`
        .aura-layer {
          position: absolute;
          inset: -40%;
          background-image: radial-gradient(
              circle at 15% 20%,
              rgba(255, 255, 255, 0.45),
              transparent 60%
            ),
            radial-gradient(
              circle at 80% 20%,
              rgba(0, 255, 200, 0.35),
              transparent 60%
            ),
            radial-gradient(
              circle at 20% 80%,
              rgba(255, 255, 255, 0.3),
              transparent 60%
            ),
            radial-gradient(
              circle at 85% 80%,
              rgba(0, 255, 255, 0.4),
              transparent 60%
            );
          background-size: 170% 170%;
          mix-blend-mode: screen;
          filter: blur(6px);
          animation: aura-move 14s ease-in-out infinite alternate;
          transition: opacity 0.2s ease-out, transform 0.2s ease-out;
        }

        .bar-halo {
          position: absolute;
          left: 50%;
          top: 46%;
          width: 70vw;
          max-width: 900px;
          height: 140px;
          background: radial-gradient(
            ellipse at center,
            rgba(255, 255, 255, 0.75),
            rgba(255, 255, 255, 0.1) 50%,
            transparent 70%
          );
          filter: blur(4px);
          mix-blend-mode: screen;
          transition: opacity 0.15s ease-out, transform 0.15s ease-out;
        }

        @keyframes aura-move {
          0% {
            background-position: 0% 0%;
          }
          50% {
            background-position: 100% 40%;
          }
          100% {
            background-position: 0% 100%;
          }
        }
      `}</style>
    </div>
  );
}
