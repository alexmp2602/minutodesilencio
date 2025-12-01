// src/components/SkyOverlay.tsx
"use client";

import * as React from "react";

type Props = {
  /** 0..1: 0 = inicio; 1 = transición al jardín completa */
  progress: number;
};

export default function SkyOverlay({ progress }: Props) {
  const prefersReduced = usePrefersReducedMotion();

  const fade = prefersReduced ? 1 : clamp(mapRange(progress, 0.15, 0.7, 1, 0));
  const haloScale = prefersReduced
    ? 1
    : clamp(mapRange(progress, 0, 0.6, 1, 1.18));

  return (
    <div
      role="presentation"
      aria-hidden="true"
      data-sky-overlay
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        opacity: fade,
        transition: prefersReduced ? "none" : "opacity .25s linear",
        willChange: "opacity",
      }}
    >
      {/* Halo central */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          transform: `translateZ(0) scale(${haloScale})`,
          willChange: prefersReduced ? undefined : "transform",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: "min(68vmin, 540px)",
            height: "min(68vmin, 540px)",
            borderRadius: "50%",
            filter: "blur(14px)",
            background:
              "radial-gradient(circle at 50% 50%, var(--halo-core) 0%, var(--halo-warm) 52%, transparent 62%)",
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "min(68vmin, 540px)",
            height: "min(68vmin, 540px)",
            borderRadius: "50%",
            filter: "blur(16px)",
            background:
              "radial-gradient(circle at 50% 50%, color-mix(in oklab, var(--halo-blue), transparent 45%) 0%, transparent 75%)",
            opacity: 0.85,
          }}
        />
      </div>

      {/* Viñeta ligera para contraste */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(80% 70% at 50% 30%, transparent 40%, rgba(0,0,0,.08) 90%)",
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}

/* helpers */
function mapRange(v: number, a: number, b: number, c: number, d: number) {
  if (a === b) return d;
  return c + ((v - a) * (d - c)) / (b - a);
}

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

/* Respeta prefers-reduced-motion del sistema */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);

    update();
    mq.addEventListener?.("change", update);

    return () => mq.removeEventListener?.("change", update);
  }, []);

  return reduced;
}
