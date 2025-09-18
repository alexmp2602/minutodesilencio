"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";

const TOTAL_SEC = 60 as const;
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

type Props = { onComplete: () => void };

export default function Ritual({ onComplete }: Props) {
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onComplete]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
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
      startedRef.current = false;
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
  const circumference = 2 * Math.PI * 116;

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
              strokeDasharray={circumference}
              strokeDashoffset={(1 - progress) * circumference}
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "130px 130px",
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
