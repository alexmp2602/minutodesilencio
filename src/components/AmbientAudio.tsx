"use client";

import { useEffect, useRef } from "react";

/** Audio ambiente con fade in/out y desbloqueo en primer gesto. */
export default function AmbientAudio({
  src,
  volume = 0.18,
  fadeInMs = 1500,
  fadeOutMs = 600,
}: {
  src: string;
  volume?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 1) Capturamos la ref una sola vez (recomendación de React/ESLint)
    const audio = ref.current;
    if (!audio) return;

    // Handlers (definidos antes para poder limpiarlos)
    const onError = () => {
      console.warn("[AmbientAudio] error de carga/decodificación", audio.error);
    };

    function unlock() {
      // 2) TS feliz: volvemos a chequear por seguridad
      if (!audio) return;
      audio.play().catch(() => {
        /* silenciamos */
      });
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }

    // Setup
    audio.addEventListener("error", onError);
    audio.loop = true;
    audio.muted = false;
    audio.volume = 0;

    // Soporte MP3 y primer intento
    const canMp3 = audio.canPlayType("audio/mpeg") !== "";
    if (canMp3) {
      try {
        audio.load();
        // 3) TS: usamos la variable local `audio`, no la ref
        audio.play().catch(() => {});
      } catch (err) {
        console.warn("[AmbientAudio] play() lanzó excepción", err);
      }
    } else {
      console.warn("[AmbientAudio] el navegador no reporta soporte para MP3");
    }

    // Fallback de desbloqueo (primer gesto)
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    // Fade in
    const steps = Math.max(1, Math.round(fadeInMs / 100));
    const up = window.setInterval(() => {
      const v = audio.volume;
      if (v >= volume) {
        audio.volume = volume;
        window.clearInterval(up);
        return;
      }
      audio.volume = Math.min(volume, v + volume / steps);
    }, 100);

    // Cleanup (usa `audio` capturado: no toca `ref.current`)
    return () => {
      window.clearInterval(up);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audio.removeEventListener("error", onError);

      const stepsOut = Math.max(1, Math.round(fadeOutMs / 100));
      const step = audio.volume / stepsOut;
      const down = window.setInterval(() => {
        audio.volume = Math.max(0, audio.volume - step);
        if (audio.volume <= 0) {
          window.clearInterval(down);
          audio.pause();
        }
      }, 100);
    };
  }, [src, volume, fadeInMs, fadeOutMs]);

  return (
    <audio ref={ref} preload="auto" playsInline autoPlay>
      <source src={src} type="audio/mpeg" />
    </audio>
  );
}
