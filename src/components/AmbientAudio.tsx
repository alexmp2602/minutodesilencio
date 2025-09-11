"use client";

import { useEffect, useRef } from "react";

/**
 * Reproduce un <audio> con fade in/out y fallback de "unlock" en el primer gesto del usuario.
 * Funciona en iOS/Safari/Chrome. Evita errores de autoplay bloqueado.
 */
export default function AmbientAudio({
  src,
  volume = 0.18,            // subo un poco para test; luego lo bajás si querés
  fadeInMs = 1500,
  fadeOutMs = 600,
}: {
  src: string;               // <- obligatorio, así evitamos rutas mal puestas
  volume?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const unlockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;

    a.volume = 0;
    a.loop = true;
    a.muted = false;

    // Intento inmediato de reproducción (si ya hubo interacción previa, funciona)
    a.play().catch(() => { /* silenciamos, probaremos el unlock */ });

    // Fallback: en el primer gesto del usuario, intentamos reproducir
    const unlock = () => {
      a.play().catch(() => {/* último recurso, no hacemos nada */});
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    unlockRef.current = unlock;
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    // Fade in
    const steps = Math.max(1, Math.round(fadeInMs / 100));
    const up = setInterval(() => {
      if (!ref.current) return;
      const v = ref.current.volume;
      if (v >= volume) { ref.current.volume = volume; clearInterval(up); return; }
      ref.current.volume = Math.min(volume, v + volume / steps);
    }, 100);

    // Limpieza + fade out
    return () => {
      clearInterval(up);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);

      const a2 = ref.current;
      if (!a2) return;

      const step = (a2.volume / Math.max(1, Math.round(fadeOutMs / 100)));
      const down = setInterval(() => {
        if (!a2) return;
        a2.volume = Math.max(0, a2.volume - step);
        if (a2.volume <= 0) {
          clearInterval(down);
          a2.pause();
        }
      }, 100);
    };
  }, [src, volume, fadeInMs, fadeOutMs]);

  return (
    <audio
      ref={ref}
      src={src}
      preload="auto"
      playsInline
      autoPlay
    />
  );
}
