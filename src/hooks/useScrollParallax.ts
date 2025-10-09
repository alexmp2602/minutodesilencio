// src/hooks/useScrollParallax.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Progreso 0..1 mientras scrolleás por la sección “cielo”.
 * Definición exacta del rango:
 *   - 0 cuando el top del sky está en la parte inferior del viewport (rect.top === vh)
 *   - 1 cuando el bottom del sky pasa por el top del viewport (rect.bottom === 0)
 *
 * Queda clamp(0..1) fuera de ese rango.
 */
export default function useScrollParallax() {
  const skyRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastProgressRef = useRef<number>(-1);
  const [progress, setProgress] = useState(0);

  // Cache de medidas para evitar getBoundingClientRect() completo cada frame
  const skyHeightRef = useRef<number>(0);

  // Media query para reducir trabajo si el usuario lo pidió
  const reducedMotion = usePrefersReducedMotion();

  const epsilon = 1e-3;

  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const getViewportHeight = () => {
    // visualViewport maneja mejor barras del navegador en mobile
    // fallback a innerHeight
    // Nota: en SSR no se ejecuta este código.
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return Math.max(
      1,
      Math.floor((vv?.height as number) || window.innerHeight || 1)
    );
  };

  const compute = useCallback(() => {
    const el = skyRef.current;
    if (!el) {
      if (lastProgressRef.current !== 0) {
        lastProgressRef.current = 0;
        setProgress(0);
      }
      return;
    }

    const vh = getViewportHeight();
    // Solo leemos top (y usamos height cacheado); rect.height se actualiza con ResizeObserver
    const rect = el.getBoundingClientRect();
    const height = skyHeightRef.current || rect.height || 1;

    // Rango exacto mapeado con rect.top:
    //  start: rect.top === vh
    //  end:   rect.bottom === 0  => rect.top === -height
    const start = vh;
    const end = -height;
    const denom = end - start || -1; // evita división por 0
    const t = (rect.top - start) / denom; // mapea start..end -> 0..1
    const k = clamp01(t);

    // Evitar renders si el cambio es minúsculo
    if (Math.abs(k - lastProgressRef.current) > epsilon) {
      lastProgressRef.current = k;
      setProgress(k);
    }
  }, []);

  const lastTickRef = useRef<number>(0);
  const loop = useCallback(
    (now: number) => {
      // Si el usuario prefiere menos movimiento, muestreamos menos (≈10 FPS)
      const minDelta = reducedMotion ? 100 : 0; // ms
      if (!lastTickRef.current || now - lastTickRef.current >= minDelta) {
        compute();
        lastTickRef.current = now;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [compute, reducedMotion]
  );

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    // Primer cómputo inmediato para evitar frame en blanco
    compute();
    rafRef.current = requestAnimationFrame(loop);
  }, [compute, loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => {
    const el = skyRef.current;
    if (!el) return;

    // Observamos visibilidad del elemento para activar/desactivar rAF (ahorro de CPU)
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible) start();
        else stop();
      },
      {
        root: null,
        rootMargin: "100% 0px 100% 0px", // margen grande para activar un poco antes
        threshold: 0,
      }
    );
    io.observe(el);

    // Observamos cambios de tamaño del sky para refrescar height cacheada
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h =
            entry.borderBoxSize?.[0]?.blockSize ??
            entry.contentBoxSize?.[0]?.blockSize ??
            entry.contentRect?.height ??
            el.getBoundingClientRect().height;
          skyHeightRef.current = Math.max(1, Math.floor(h || 0));
        }
        compute();
      });
      ro.observe(el);
    } else {
      // Fallback: medimos una vez
      skyHeightRef.current = el.getBoundingClientRect().height || 1;
    }

    // Resize/zoom/orientation: refrescamos métricas
    const onResize = () => compute();
    const onVVResize = () => compute();
    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener?.("resize", onVVResize, {
      passive: true,
    } as AddEventListenerOptions);

    // Pausar rAF cuando la pestaña no está visible (aún si IO dice visible)
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Cómputo inicial
    compute();

    return () => {
      io.disconnect();
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener?.("resize", onVVResize);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [compute, start, stop]);

  // Props para asignar el ref desde el DOM
  const skyProps = useMemo(
    () => ({
      ref: (el: HTMLElement | null) => {
        skyRef.current = el;
        if (el) {
          // Actualizamos height cacheada y recomputamos al montar
          const rect = el.getBoundingClientRect();
          skyHeightRef.current = rect.height || skyHeightRef.current || 1;
          compute();
        }
      },
    }),
    [compute]
  );

  return { progress, skyProps };
}

/* ===========================
   Utilidades
   =========================== */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(!!mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}
