// src/hooks/useSfx.ts
"use client";
import { useCallback, useRef } from "react";

type Src = { src: string; type?: string };

const SUPPORTED_MIME = ["audio/mpeg", "audio/ogg", "audio/wav"];

export default function useSfx() {
  // Cacheamos objetos Audio por URL para evitar relaunch/redescargas
  const cache = useRef<Map<string, HTMLAudioElement>>(new Map());

  const pickSupported = (sources: Src[]) => {
    const probe = document.createElement("audio");
    // priorizamos por MIME conocido; si no hay, probamos extensiones
    for (const s of sources) {
      const type = s.type ?? "";
      if (!type || SUPPORTED_MIME.includes(type)) {
        if (!type || probe.canPlayType(type)) return s;
      }
    }
    // último intento por extensión
    return sources.find((s) => {
      const u = s.src.toLowerCase();
      return u.endsWith(".mp3") || u.endsWith(".ogg") || u.endsWith(".wav");
    });
  };

  const playFile = useCallback(async (sources: Src[]) => {
    try {
      const pick = pickSupported(sources);
      if (!pick) return;

      let a = cache.current.get(pick.src);
      if (!a) {
        a = new Audio(pick.src);
        a.preload = "auto";
        a.crossOrigin = "anonymous";
        cache.current.set(pick.src, a);
      } else {
        // si ya terminó antes, volvemos al inicio
        try {
          a.currentTime = 0;
        } catch {}
      }

      await a.play().catch(() => {
        // algunos navegadores exigen gesto del usuario; ignoramos el error
      });
    } catch {
      /* no-op */
    }
  }, []);

  return { playFile };
}
