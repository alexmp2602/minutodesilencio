// app/components/AmbientAudio.tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/store/useAppStore";

type Props = {
  src: string;
  volume?: number; // volumen objetivo [0..1]
  fadeMs?: number; // duración del fade in/out
  pauseOnHidden?: boolean; // pausar al ocultar pestaña
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function AmbientAudio({
  src,
  volume = 0.15,
  fadeMs = 280,
  pauseOnHidden = true,
}: Props) {
  const muted = useAppStore((s) => s.muted);
  const audioRef = useRef<HTMLAudioElement>(null);

  // estado mutable
  const targetVolRef = useRef(clamp01(volume));
  targetVolRef.current = clamp01(volume);

  // refs para control interno
  const fadeRafRef = useRef<number | null>(null);
  const fadeCancelRef = useRef(false);
  const pauseTimeoutRef = useRef<number | null>(null);

  const cancelFade = useCallback(() => {
    fadeCancelRef.current = true;
    if (fadeRafRef.current) {
      cancelAnimationFrame(fadeRafRef.current);
      fadeRafRef.current = null;
    }
  }, []);

  const clearPauseTimeout = useCallback(() => {
    if (pauseTimeoutRef.current != null) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
  }, []);

  // Fade lineal con clamp y cancelable (estable para deps)
  const fadeTo = useCallback(
    (el: HTMLAudioElement, to: number, ms: number) => {
      cancelFade();
      fadeCancelRef.current = false;

      const from = clamp01(el.volume);
      const target = clamp01(to);
      const start = performance.now();
      const dur = Math.max(1, ms);

      const step = (t: number) => {
        if (fadeCancelRef.current) return;
        const k = clamp01((t - start) / dur);
        const v = clamp01(from + (target - from) * k);
        el.volume = v;
        if (k < 1) {
          fadeRafRef.current = requestAnimationFrame(step);
        } else {
          fadeRafRef.current = null;
        }
      };

      fadeRafRef.current = requestAnimationFrame(step);
    },
    [cancelFade]
  );

  // Arranque / autoplay + listeners globales
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    el.loop = true;
    el.preload = "auto";
    el.muted = false; // controlamos por volume para poder hacer fade
    el.volume = 0;

    const tryPlay = () =>
      el.play().catch(() => {
        /* algunos navegadores bloquean autoplay */
      });

    if (!muted) {
      tryPlay().then(() => fadeTo(el, targetVolRef.current, fadeMs));
    }

    const unlock = () => {
      if (!muted && el.paused) {
        el.volume = 0;
        tryPlay().then(() => fadeTo(el, targetVolRef.current, fadeMs));
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchend", unlock, { once: true });

    const onVisibility = () => {
      if (!pauseOnHidden) return;
      if (document.hidden) {
        el.pause();
      } else if (!muted) {
        tryPlay();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
      cancelFade();
      clearPauseTimeout();
      el.pause();
    };
  }, [
    src,
    muted,
    pauseOnHidden,
    fadeMs,
    fadeTo,
    cancelFade,
    clearPauseTimeout,
  ]);

  // Reaccionar a mute/unmute
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    clearPauseTimeout();

    if (muted) {
      fadeTo(el, 0, fadeMs);
      pauseTimeoutRef.current = window.setTimeout(() => {
        el.pause();
      }, fadeMs + 20);
    } else {
      const resume = () =>
        el.play().catch(() => {
          /* se habilitará tras un gesto */
        });

      if (el.paused) {
        el.volume = 0;
        resume().then(() => fadeTo(el, targetVolRef.current, fadeMs));
      } else {
        fadeTo(el, targetVolRef.current, fadeMs);
      }
    }
  }, [muted, fadeMs, fadeTo, clearPauseTimeout]);

  // Cambios de "volume" (prop) en caliente
  useEffect(() => {
    const el = audioRef.current;
    if (!el || muted) return;
    fadeTo(el, targetVolRef.current, Math.max(120, Math.min(600, fadeMs)));
  }, [volume, muted, fadeMs, fadeTo]);

  return (
    <audio
      ref={audioRef}
      src={src}
      playsInline
      crossOrigin="anonymous"
      aria-hidden="true"
      hidden
      tabIndex={-1}
      data-audio="ambient"
    />
  );
}
