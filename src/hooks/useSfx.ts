// src/hooks/useSfx.ts
"use client";
import { useCallback } from "react";

export default function useSfx() {
  const playFile = useCallback(
    (sources: Array<{ src: string; type: string }>) => {
      try {
        const probe = document.createElement("audio");
        const pick = sources.find((s) => probe.canPlayType(s.type));
        if (!pick) return; // si no hay soporte, no hacemos nada
        const a = new Audio(pick.src);
        a.play().catch(() => {}); // por si el navegador bloquea sin gesto
      } catch {}
    },
    []
  );
  return { playFile };
}
