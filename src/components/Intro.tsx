"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import type React from "react";

type CSSVars = React.CSSProperties & { ["--fade-ms"]?: string };
type Props = { onStart: () => void };

export default function Intro({ onStart }: Props) {
  const { setStage } = useAppStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") onStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  const style: CSSVars = { ["--fade-ms"]: "1200ms" };

  return (
    <section
      className="screen bg-radial place-items-center allow-motion intro-root"
      role="region"
      aria-labelledby="intro-title"
      aria-describedby="intro-desc"
      style={style}
    >
      <div aria-hidden="true" className="intro-portal" />

      <div className="intro-card fade-in-600 text-center">
        <h1 id="intro-title" className="h1">
          minutodesilencio
        </h1>
        <p id="intro-desc" className="muted mt-8 text-balance">
          Antes de entrar, esperá un minuto en memoria de lo que ya no está.
          <br />
          Al finalizar, vas a acceder al jardín digital.
        </p>
        <button
          className="btn mt-16"
          onClick={() => {
            setStage("ritual");
            onStart();
          }}
          aria-label="Continuar al ritual de un minuto"
        >
          Comenzar
        </button>
      </div>

      <style jsx>{`
        /* evita que el blur del halo genere scroll vertical */
        .intro-root {
          overflow: hidden;
        }
        @supports (overflow: clip) {
          .intro-root {
            overflow: clip;
          }
        }

        .intro-portal {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        @supports (overflow: clip) {
          .intro-portal {
            overflow: clip;
          }
        }

        .intro-portal::before,
        .intro-portal::after {
          content: "";
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          border-radius: 9999px;
          filter: blur(100px);
          will-change: transform, opacity;
        }
        .intro-portal::before {
          top: -12rem;
          width: min(70vw, 52rem);
          height: min(70vw, 52rem);
          background: rgba(108, 197, 255, 0.12);
          animation: halo-pulse 4.2s ease-in-out infinite;
        }
        .intro-portal::after {
          top: 18vh;
          width: min(48vw, 32rem);
          height: min(48vw, 32rem);
          filter: none;
          background: radial-gradient(
              closest-side,
              rgba(108, 197, 255, 0.16),
              transparent 65%
            ),
            radial-gradient(
              closest-side,
              rgba(108, 197, 255, 0.08),
              transparent 72%
            ),
            radial-gradient(
              closest-side,
              rgba(108, 197, 255, 0.05),
              transparent 80%
            );
          animation: ring-breathe 6s var(--easing) infinite;
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
        @keyframes ring-breathe {
          0%,
          100% {
            opacity: 0.7;
            transform: translateX(-50%) scale(1);
          }
          50% {
            opacity: 1;
            transform: translateX(-50%) scale(1.04);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.allow-motion) .intro-portal::before,
          :global(.allow-motion) .intro-portal::after {
            animation-duration: 1200ms;
          }
        }
      `}</style>
    </section>
  );
}
