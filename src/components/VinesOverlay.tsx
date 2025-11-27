// src/components/VinesOverlay.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = {
  /** Solo activo durante la fase "loading" */
  active: boolean;
  /** Ruta del SVG en /public */
  src?: string;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export default function VinesOverlay({
  active,
  src = "/vines_anim.svg",
}: Props): React.ReactElement | null {
  const [svgText, setSvgText] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgElRef = useRef<SVGSVGElement | null>(null);
  const lastKRef = useRef(0);

  // Cargar SVG como texto
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        console.log("[Vines] fetching SVG", src);
        const res = await fetch(src, { cache: "force-cache" });
        const text = await res.text();
        if (!cancelled) {
          setSvgText(text);
          console.log("[Vines] SVG loaded, length:", text.length);
        }
      } catch (err) {
        console.error("[Vines] error loading SVG", err);
        if (!cancelled) setSvgText("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  // Tomar referencia al <svg> y setear estado inicial
  useEffect(() => {
    if (!wrapRef.current) return;
    const svg = wrapRef.current.querySelector("svg") as SVGSVGElement | null;
    svgElRef.current = svg;

    if (svg) {
      console.log("[Vines] init svg element");
      svg.style.opacity = "0";
      svg.style.transform = "scale(0.9)";
      svg.style.transformOrigin = "50% 50%";
      svg.style.transition = "opacity 260ms ease-out, transform 260ms ease-out";
      applyK(lastKRef.current); // aplicar último valor conocido
    }
  }, [svgText]);

  // Aplica la animación a TODO el SVG (simple)
  const applyK = (rawK: number) => {
    const svg = svgElRef.current;
    if (!svg) return;

    const k = clamp01(rawK);
    const eased = easeOutCubic(k);

    const opacity = 0.1 + 0.9 * eased; // nunca 100% invisible
    const scale = 0.9 + 0.1 * eased; // 0.9 → 1.0

    svg.style.opacity = opacity.toString();
    svg.style.transform = `scale(${scale})`;
  };

  // Escuchar progreso SOLO cuando está activo
  useEffect(() => {
    if (!active) {
      lastKRef.current = 0;
      applyK(0);
      return;
    }

    const onP = (e: Event) => {
      const detail = (e as CustomEvent).detail as { k?: number } | undefined;
      const v = typeof detail?.k === "number" ? detail.k : 0;
      lastKRef.current = v;
      console.log("[Vines] progress k =", v.toFixed(3));
      applyK(v);
    };

    window.addEventListener("silence:progress", onP as EventListener);
    return () => {
      window.removeEventListener("silence:progress", onP as EventListener);
    };
  }, [active]);

  if (!active || !svgText) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        ref={wrapRef}
        style={{ width: "100%", height: "100%" }}
        dangerouslySetInnerHTML={{ __html: svgText }}
      />
    </div>
  );
}
