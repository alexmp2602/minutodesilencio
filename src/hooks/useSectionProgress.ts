// src/hooks/useSectionProgress.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Devuelve un progreso 0..1 según el scroll sobre una sección.
 * 0: el top de la sección está a la altura del bottom del viewport.
 * 1: el bottom de la sección ya pasó por el top del viewport.
 */
export default function useSectionProgress() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastProgressRef = useRef<number>(-1);
  const [progress, setProgress] = useState(0);

  // Altura cacheada para evitar medir todo el rect en cada frame
  const sectionHeightRef = useRef<number>(0);

  const reducedMotion = usePrefersReducedMotion();
  const epsilon = 1e-3;

  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const getViewportHeight = () => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return Math.max(
      1,
      Math.floor((vv?.height as number) || window.innerHeight || 1)
    );
  };

  const compute = useCallback(() => {
    const el = sectionRef.current;
    if (!el) {
      if (lastProgressRef.current !== 0) {
        lastProgressRef.current = 0;
        setProgress(0);
      }
      return;
    }

    const vh = getViewportHeight();
    const rect = el.getBoundingClientRect();
    const height = sectionHeightRef.current || rect.height || 1;

    // Mismo rango que useScrollParallax:
    // top: vh  → bottom: 0  (reexpresado vía rect.top)
    const start = vh;
    const end = -height;
    const denom = end - start || -1;
    const t = (rect.top - start) / denom;
    const k = clamp01(t);

    if (Math.abs(k - lastProgressRef.current) > epsilon) {
      lastProgressRef.current = k;
      setProgress(k);
    }
  }, []);

  const lastTickRef = useRef<number>(0);

  const loop = useCallback(
    (now: number) => {
      // Con prefers-reduced-motion activo se reduce la frecuencia de muestreo
      const minDelta = reducedMotion ? 100 : 0;
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
    compute();
    rafRef.current = requestAnimationFrame(loop);
  }, [compute, loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    // Activa/desactiva el rAF según la visibilidad de la sección
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible) start();
        else stop();
      },
      { root: null, rootMargin: "100% 0px 100% 0px", threshold: 0 }
    );
    io.observe(el);

    // Observa cambios de tamaño para refrescar la altura guardada
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h =
            entry.borderBoxSize?.[0]?.blockSize ??
            entry.contentBoxSize?.[0]?.blockSize ??
            entry.contentRect?.height ??
            el.getBoundingClientRect().height;
          sectionHeightRef.current = Math.max(1, Math.floor(h || 0));
        }
        compute();
      });
      ro.observe(el);
    } else {
      sectionHeightRef.current = el.getBoundingClientRect().height || 1;
    }

    // Recalcula en cambios de viewport (resize/orientación/zoom)
    const onResize = () => compute();
    const onVVResize = () => compute();
    window.addEventListener("resize", onResize, { passive: true });
    window.visualViewport?.addEventListener?.("resize", onVVResize, {
      passive: true,
    } as AddEventListenerOptions);

    // Pausa cuando la pestaña está oculta
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

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

  const bind = useMemo(
    () => ({
      ref: (el: HTMLElement | null) => {
        sectionRef.current = el;
        if (el) {
          const rect = el.getBoundingClientRect();
          sectionHeightRef.current =
            rect.height || sectionHeightRef.current || 1;
          compute();
        }
      },
    }),
    [compute]
  );

  return { progress, bind };
}

// Hook para prefers-reduced-motion
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
