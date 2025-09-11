"use client";

import { useEffect, useMemo, useState } from "react";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";

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

export default function Ritual({ onComplete }: { onComplete: () => void }) {
  const [elapsed, setElapsed] = useState(0);

  // avanzar tiempo
  useEffect(() => {
    if (elapsed >= TOTAL) {
      onComplete();
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [elapsed, onComplete]);

  const progress = Math.min(elapsed / TOTAL, 1);

  const segment = useMemo(() => {
    return (
      SEGMENTS.find((seg) => elapsed < seg.to) ?? SEGMENTS[SEGMENTS.length - 1]
    );
  }, [elapsed]);

  return (
    <section className="screen bg-radial" aria-label="Un minuto de silencio">
      {/* audio ambiente sutil */}
      <AmbientAudio src="/ambience-soft.mp3" volume={0.15} />
      <MuteButton />

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

        {/* textos con crossfade */}
        <div className="crossfade" aria-live="polite">
          <h2 key={segment.title} className="crossfade-item title">
            {segment.title}
          </h2>
          <p key={segment.text} className="crossfade-item text text-balance">
            {segment.text}
          </p>
        </div>

        {/* Botón Saltear minimalista */}
        <button
          className="skip-btn"
          onClick={onComplete}
          aria-label="Saltear ritual"
        >
          ↦
        </button>
      </div>
    </section>
  );
}
