// app/components/AmbientAudio.tsx
"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

type Props = { src: string; volume?: number };

export default function AmbientAudio({ src, volume = 0.15 }: Props) {
  const muted = useAppStore((s) => s.muted);
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.volume = volume;
    el.muted = muted;

    if (muted) {
      el.pause();
    } else {
      // Forzar autoplay si el navegador lo permite
      el.autoplay = true;
      el.play().catch(() => {});
    }

    return () => {
      el.pause();
    };
  }, [muted, volume]);

  return (
    <audio
      ref={ref}
      src={src}
      loop
      preload="auto"
      aria-hidden="true"
      hidden
      tabIndex={-1}
    />
  );
}
