// src/app/page.tsx
"use client";

import React from "react";
import UnifiedParallaxWorld from "@/components/UnifiedParallaxWorld";
import useScrollParallax from "@/hooks/useScrollParallax";
import useSectionProgress from "@/hooks/useSectionProgress";
import TextOverlay from "@/components/TextOverlay";

export default function HomePage() {
  const { progress: introProgress, skyProps } = useScrollParallax();
  const { progress: minuteProgress, bind: minuteBind } = useSectionProgress();

  const [gardenK, setGardenK] = React.useState(0);
  React.useEffect(() => {
    const onGarden = (e: Event) => {
      const ev = e as CustomEvent<{ k?: number; entered?: boolean }>;
      if (ev.detail?.entered) return setGardenK(1);      // fuerza 1 cuando entrás
      if (typeof ev.detail?.k === "number") setGardenK(ev.detail.k);
    };
    window.addEventListener("ms:garden", onGarden as EventListener);
    return () =>
      window.removeEventListener("ms:garden", onGarden as EventListener);
  }, []);

  const overlayAlpha = 1 - gardenK;
  const showOverlay = overlayAlpha > 0.01;  // umbral para desmontaje

  return (
    <main className="parallax-root" aria-label="Recorrido continuo">
      <div className="sticky-canvas">
        <UnifiedParallaxWorld
          introProgress={introProgress}
          minuteProgress={minuteProgress}
        />
      </div>

      {/* Intro (cielo) */}
      <section
        {...skyProps}
        style={{
          height: "150vh",
          opacity: overlayAlpha,
          transition: "opacity .38s ease",
          visibility: showOverlay ? "visible" : "hidden",
        }}
        aria-hidden
      />
      {/* Overlay de textos — fade + desmontaje */}
      <div
        style={{
          opacity: overlayAlpha,
          transition: "opacity .38s ease",
          visibility: showOverlay ? "visible" : "hidden",
          pointerEvents: showOverlay ? "auto" : "none",
        }}
      >
        {showOverlay && <TextOverlay progress={introProgress} />}
      </div>

      {/* Minuto: si lo vas a quitar, comentá todo este bloque */}
      <section
        {...minuteBind}
        style={{
          height: "170vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          opacity: overlayAlpha,
          transition: "opacity .38s ease",
          visibility: showOverlay ? "visible" : "hidden",
          pointerEvents: showOverlay ? "auto" : "none",
        }}
      >
        {/* <MinuteRitual visibleK={minuteProgress} durationMs={60000} /> */}
      </section>

      <section aria-hidden style={{ height: "160vh" }} />
    </main>
  );
}
