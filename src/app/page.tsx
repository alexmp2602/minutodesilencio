"use client";

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

  return (
    <main className="parallax-root" aria-label="Recorrido continuo">
      {/* Canvas pegado a la ventana - un solo scrollbar */}
      <div className="sticky-canvas">
        <UnifiedParallaxWorld
          introProgress={introProgress}
          minuteProgress={minuteProgress}
        />
      </div>

      {/* Intro: cielo + mensajes */}
      <section {...skyProps} style={{ height: "150vh" }} aria-hidden />

      <TextOverlay progress={introProgress} />

      {/* Sección del minuto — durante esto NO se puede avanzar */}
      <section
        {...minuteBind}
        style={{
          height: "170vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
        }}
      >
        <MinuteRitual
          visibleK={minuteProgress}
          durationMs={60000}
          onComplete={() => {
            // opcional: podrías registrar analytics / vibración leve, etc.
          }}
        />
      </section>

      {/* Runway para que, una vez terminado el minuto, el usuario baje y
          la cámara descienda hasta el jardín */}
      <section aria-hidden style={{ height: "160vh" }} />
    </main>
  );
}
