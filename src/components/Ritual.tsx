"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";

const TOTAL_SEC = 60;
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
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = performance.now();
    startRef.current = start;
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

  return (
    <section className="screen bg-radial" aria-label="Un minuto de silencio">
      <AmbientAudio src="/ambience-soft.mp3" volume={0.15} />
      <MuteButton />

      <div className="ritual-wrap">
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
                transition: "stroke-dashoffset .12s linear",
              }}
            />
          </svg>
          <div className="circle-time" aria-live="polite">
            {remainingSec}s
          </div>
        </div>

        <div className="crossfade" aria-live="polite">
          <h2 key={segment.title} className="crossfade-item title">
            {segment.title}
          </h2>
          <p key={segment.text} className="crossfade-item text text-balance">
            {segment.text}
          </p>
        </div>

        <button
          type="button"
          className="skip-btn"
          onClick={onComplete}
          aria-label="Saltar el minuto y pasar al jardín"
          title="Saltar"
        >
          ⏭
        </button>
      </div>
    </section>
  );
}
