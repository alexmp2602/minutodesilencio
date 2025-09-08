"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const Scene = dynamic(() => import("@/components/garden/Scene"), {
  ssr: false,
});

const TOTAL = 60;
const SEGMENTS = [
  {
    to: 12,
    title: "Preparación...",
    text: "Tomá un instante para estar presente.",
  },
  { to: 26, title: "Respirá...", text: "Inhalá y exhalá con calma." },
  { to: 44, title: "Recordá...", text: "Pensá en lo que querés despedir." },
  { to: 60, title: "Silencio...", text: "Guardemos silencio juntos." },
] as const;

type Phase = "intro" | "ritual" | "garden";

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [elapsed, setElapsed] = useState(0); // 0..TOTAL

  function startRitual() {
    if (phase !== "intro") return;
    setPhase("ritual");
    setElapsed(0);
  }

  // avanzar tiempo durante el ritual
  useEffect(() => {
    if (phase !== "ritual") return;
    if (elapsed >= TOTAL) {
      setPhase("garden");
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase, elapsed]);

  const progress = Math.min(elapsed / TOTAL, 1);
  const segment = useMemo(() => {
    const s =
      SEGMENTS.find((seg) => elapsed < seg.to) ?? SEGMENTS[SEGMENTS.length - 1];
    return s;
  }, [elapsed]);

  /* GARDEN */
  if (phase === "garden") {
    return (
      <section className="screen">
        <div className="fade-in-600"></div>
        <Scene />
      </section>
    );
  }

  /* INTRO */
  if (phase === "intro") {
    return (
      <section className="screen bg-radial">
        <div className="intro-card fade-in-600">
          <h1 className="h1">minutodesilencio</h1>
          <p className="muted mt-8 text-balance">
            Un breve ritual para despedir y recordar. Al finalizar, ingresarás a
            un jardín digital.
          </p>
          <button
            className="btn mt-16"
            onClick={startRitual}
            aria-label="Comenzar ritual"
          >
            Comenzar
          </button>
        </div>
      </section>
    );
  }

  /* RITUAL */
  return (
    <section className="screen bg-radial" aria-label="Un minuto de silencio">
      <div className="ritual-wrap">
        {/* círculo de progreso */}
        <div className="circle-wrap">
          <svg
            width="260"
            height="260"
            viewBox="0 0 260 260"
            aria-hidden="true"
          >
            <circle
              cx="130"
              cy="130"
              r="116"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="130"
              cy="130"
              r="116"
              stroke="var(--primary)"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 116}
              strokeDashoffset={(1 - progress) * 2 * Math.PI * 116}
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "130px 130px",
                transition: "stroke-dashoffset .95s linear",
              }}
            />
          </svg>
          <div className="circle-time">{TOTAL - elapsed}s</div>
        </div>

        {/* textos con líneas balanceadas */}
        <div className="crossfade" aria-live="polite">
          <h2 key={segment.title} className="crossfade-item title">
            {segment.title}
          </h2>
          <p key={segment.text} className="crossfade-item text text-balance">
            {segment.text}
          </p>
        </div>
      </div>
    </section>
  );
}
