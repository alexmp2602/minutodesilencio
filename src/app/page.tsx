// src/app/page.tsx
"use client";

import React from "react";
import UnifiedParallaxWorld from "@/components/UnifiedParallaxWorld";
import useScrollParallax from "@/hooks/useScrollParallax";
import useSectionProgress from "@/hooks/useSectionProgress";
import TextOverlay from "@/components/TextOverlay";
import MinuteRitual from "@/components/ui/MinuteRitual";

export default function HomePage() {
  // Intro (cielo + mensajes)
  const { progress: introProgress, skyProps } = useScrollParallax();
  // Sección “minuto”
  const { progress: minuteProgress, bind: minuteBind } = useSectionProgress();

  // Mezcla que viene del canvas: 0 cielo — 1 jardín
  const [gardenK, setGardenK] = React.useState(0);
  React.useEffect(() => {
    const onGarden = (e: Event) => {
      const ev = e as CustomEvent<{ k?: number; entered?: boolean }>;
      if (typeof ev.detail?.k === "number") setGardenK(ev.detail.k);
      else setGardenK(ev.detail?.entered ? 1 : 0);
    };
    window.addEventListener("ms:garden", onGarden as EventListener);
    return () =>
      window.removeEventListener("ms:garden", onGarden as EventListener);
  }, []);

  const introOpacity = 1 - gardenK; // al acercarte baja, al alejarte sube

  return (
    <main className="parallax-root" aria-label="Recorrido continuo">
      {/* Canvas pegado a la ventana */}
      <div className="sticky-canvas">
        <UnifiedParallaxWorld
          introProgress={introProgress}
          minuteProgress={minuteProgress}
        />
      </div>

      {/* Intro — arranca en 1; se desvanece a medida que te acercás al jardín */}
      <section
        {...skyProps}
        style={{
          height: "150vh",
          opacity: introOpacity,
          transition: "opacity .38s ease",
        }}
        aria-hidden
      />
      <div style={{ opacity: introOpacity, transition: "opacity .38s ease" }}>
        <TextOverlay progress={introProgress} />
      </div>

      {/* Minuto — también hace fade inverso */}
      <section
        {...minuteBind}
        style={{
          height: "170vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          opacity: introOpacity,
          transition: "opacity .38s ease",
          pointerEvents: introOpacity > 0.15 ? "auto" : "none",
        }}
      >
        <MinuteRitual visibleK={minuteProgress} durationMs={60000} />
      </section>

      {/* Runway hacia el jardín */}
      <section aria-hidden style={{ height: "160vh" }} />
    </main>
  );
}
