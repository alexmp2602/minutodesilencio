// src/components/Intro.tsx
"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import type React from "react";

type StyleWithVars = React.CSSProperties & { ["--fade-ms"]?: string };

export default function Intro({ onStart }: { onStart: () => void }) {
  const { setStage } = useAppStore();

  useEffect(() => {
    setStage("intro");
  }, [setStage]);

  // Duración local de la animación de entrada
  const styleVars: StyleWithVars = { ["--fade-ms"]: "1200ms" };

  return (
    <section
      className="screen bg-radial place-items-center allow-motion"
      role="region"
      aria-labelledby="intro-title"
      style={styleVars}
    >
      {/* halo animado propio, sin Tailwind */}
      <div aria-hidden="true" className="intro-halo" />

      <div className="intro-card fade-in-600 text-center">
        <h1 id="intro-title" className="h1">
          minutodesilencio
        </h1>
        <p className="muted mt-8 text-balance">
          Un breve ritual para despedir y recordar.
          <br />
          Al finalizar, ingresarás a un jardín digital.
        </p>
        <button
          className="btn mt-16"
          onClick={onStart}
          aria-label="Comenzar ritual de un minuto"
        >
          Comenzar
        </button>
      </div>

      {/* estilos scoped para la animación del halo */}
      <style jsx>{`
        .intro-halo {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .intro-halo::before {
          content: "";
          position: absolute;
          left: 50%;
          top: -12rem; /* no tapa el centro */
          width: min(70vw, 52rem);
          height: min(70vw, 52rem);
          transform: translateX(-50%);
          border-radius: 9999px;
          filter: blur(140px);
          background: rgba(108, 197, 255, 0.12);
          animation: halo-pulse 4.2s ease-in-out infinite;
        }
        @keyframes halo-pulse {
          0%,
          100% {
            opacity: 0.55;
            transform: translateX(-50%) scale(1);
          }
          50% {
            opacity: 0.9;
            transform: translateX(-50%) scale(1.06);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.allow-motion) .intro-halo::before {
            animation-duration: 1200ms;
          }
        }
      `}</style>
    </section>
  );
}
