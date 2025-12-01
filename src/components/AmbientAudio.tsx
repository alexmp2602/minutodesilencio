// src/components/AmbientAudio.tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMute } from "@/hooks/useMute";

type Props = {
  src: string;
  // Volumen base cuando no está muteado (0..1)
  volume?: number;
  // Duración del crossfade en ms
  fadeMs?: number;
  // Pausar si la pestaña queda oculta
  pauseOnHidden?: boolean;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export default function AmbientAudio({
  src,
  volume = 0.15,
  fadeMs = 280,
  pauseOnHidden = true,
}: Props) {
  const { muted } = useMute();
  const audioRef = useRef<HTMLAudioElement>(null);

  // refs de animación y control
  const targetVolRef = useRef(clamp01(volume));
  targetVolRef.current = clamp01(volume);

  const fadeRafRef = useRef<number | null>(null);
  const fadeCancelRef = useRef(false);
  const pauseTimeoutRef = useRef<number | null>(null);

  const cancelFade = useCallback(() => {
    fadeCancelRef.current = true;
    if (fadeRafRef.current != null) {
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

  const fadeTo = useCallback(
    (el: HTMLAudioElement, to: number, ms: number) => {
      cancelFade();
      fadeCancelRef.current = false;

      const from = clamp01(el.volume);
      const target = clamp01(to);
      const start = performance.now();
      const dur = Math.max(1, ms | 0);

      const step = (t: number) => {
        if (fadeCancelRef.current) return;
        const k = clamp01((t - start) / dur);
        el.volume = from + (target - from) * k;
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

  // Configuración inicial y listeners
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    el.loop = true;
    el.preload = "auto";
    el.muted = false;
    el.volume = 0;

    const tryPlay = () => el.play().catch(() => {});

    // Desbloqueo por primera interacción (autoplay)
    const unlock = () => {
      if (!muted && el.paused) {
        el.volume = 0;
        tryPlay().then(() => fadeTo(el, targetVolRef.current, fadeMs));
      }
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchend", unlock, { once: true });

    // Pausa/reanuda según visibilidad de la pestaña
    const onVisibility = () => {
      if (!pauseOnHidden) return;
      if (document.hidden) el.pause();
      else if (!muted) tryPlay();
    };

    document.addEventListener("visibilitychange", onVisibility, {
      passive: true,
    });

    // Si arranca sin mute, reproducir con fade in
    if (!muted) {
      tryPlay().then(() => fadeTo(el, targetVolRef.current, fadeMs));
    }

    const onError = () => {
      // Próximos cambios de mute o src volverán a intentar la reproducción
    };

    el.addEventListener("error", onError);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchend", unlock);
      el.removeEventListener("error", onError);
      cancelFade();
      clearPauseTimeout();
      el.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  // Cambios de mute
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    clearPauseTimeout();

    if (muted) {
      // Fade out y pausa
      fadeTo(el, 0, fadeMs);
      pauseTimeoutRef.current = window.setTimeout(
        () => el.pause(),
        fadeMs + 30
      );
    } else {
      const resume = () => el.play().catch(() => {});
      if (el.paused) {
        el.volume = 0;
        resume().then(() => fadeTo(el, targetVolRef.current, fadeMs));
      } else {
        fadeTo(el, targetVolRef.current, fadeMs);
      }
    }
  }, [muted, fadeMs, fadeTo, clearPauseTimeout]);

  // Cambios en el volumen objetivo
  useEffect(() => {
    const el = audioRef.current;
    if (!el || muted) return;
    fadeTo(el, targetVolRef.current, Math.max(120, Math.min(600, fadeMs)));
  }, [volume, muted, fadeMs, fadeTo]);

  // Cambios de src: crossfade rápido
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    let cancelled = false;

    const swap = async () => {
      cancelFade();

      if (!el.paused && el.volume > 0) {
        await new Promise<void>((res) => {
          fadeTo(el, 0, Math.min(220, fadeMs));
          setTimeout(res, Math.min(240, fadeMs + 20));
        });
      }

      if (cancelled) return;

      el.pause();
      el.currentTime = 0;

      const onCanPlay = () => {
        el.removeEventListener("canplay", onCanPlay);
        if (!muted) {
          el.volume = 0;
          el.play().catch(() => {});
          fadeTo(el, targetVolRef.current, fadeMs);
        }
      };

      el.addEventListener("canplay", onCanPlay);

      try {
        el.load();
      } catch {
        // noop
      }
    };

    swap();

    return () => {
      cancelled = true;
    };
  }, [src, muted, fadeMs, fadeTo, cancelFade]);

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
