// src/components/AmbientAudio.tsx
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMute } from "@/hooks/useMute";

type Props = {
  src: string;
  /** Volumen objetivo cuando no está muteado (0..1) */
  volume?: number;
  /** Duración del crossfade en ms */
  fadeMs?: number;
  /** Pausar si la pestaña queda oculta */
  pauseOnHidden?: boolean;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export default function AmbientAudio({
  src,
  volume = 0.15,
  fadeMs = 280,
  pauseOnHidden = true,
}: Props) {
  const { muted } = useMute(); // 🔉 única fuente de mute global
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

  // Montaje: configura el elemento, intenta reproducir y setea listeners
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    el.loop = true;
    el.preload = "auto";
    el.muted = false; // controlamos volumen nosotros
    el.volume = 0;

    const tryPlay = () => el.play().catch(() => {});

    // Desbloqueo por primera interacción (políticas de autoplay)
    const unlock = () => {
      if (!muted && el.paused) {
        el.volume = 0;
        tryPlay().then(() => fadeTo(el, targetVolRef.current, fadeMs));
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchend", unlock, { once: true });

    // Ocultar/mostrar pestaña
    const onVisibility = () => {
      if (!pauseOnHidden) return;
      if (document.hidden) el.pause();
      else if (!muted) tryPlay();
    };
    document.addEventListener("visibilitychange", onVisibility, {
      passive: true,
    });

    // Si arranca sin estar muteado, reproducimos con fade in
    if (!muted) {
      tryPlay().then(() => fadeTo(el, targetVolRef.current, fadeMs));
    }

    // Manejo de error silencioso para evitar logs ruidosos en móviles
    const onError = () => {
      // Si hubo error de reproducción, el siguiente unmute o cambio de src reintentará
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
  }, []); // solo una vez al montar

  // Reaccionar a cambios de mute
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

  // Reaccionar a cambios de volumen objetivo
  useEffect(() => {
    const el = audioRef.current;
    if (!el || muted) return;
    // Fade hacia el nuevo volumen objetivo
    fadeTo(el, targetVolRef.current, Math.max(120, Math.min(600, fadeMs)));
  }, [volume, muted, fadeMs, fadeTo]);

  // Cambio de pista (src): crossfade rápido hacia 0, pausa, recarga y fade in si corresponde
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    let cancelled = false;

    const swap = async () => {
      cancelFade();
      // Si estaba sonando, bajamos a 0 antes de cambiar
      if (!el.paused && el.volume > 0) {
        await new Promise<void>((res) => {
          fadeTo(el, 0, Math.min(220, fadeMs));
          setTimeout(res, Math.min(240, fadeMs + 20));
        });
      }
      if (cancelled) return;

      // Forzamos recarga (Safari/Firefox en cambios rápidos)
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
        el.load(); // algunos navegadores requieren load() explícito
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
