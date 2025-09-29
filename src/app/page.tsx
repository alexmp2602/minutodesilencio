// app/page.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import Intro from "@/components/Intro";
import Ritual from "@/components/Ritual";
import Scene from "@/components/Scene";
import GardenOverlay from "@/components/GardenOverlay";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";
import { useAppStore } from "@/store/useAppStore";

export default function HomePage() {
  const { stage, setStage } = useAppStore();
  const mainRef = useRef<HTMLElement>(null);

  // Accesibilidad: al entrar al jardín, llevar el foco al <main>
  useEffect(() => {
    if (stage === "garden") mainRef.current?.focus();
  }, [stage]);

  // Texto accesible del estado actual (anunciado por sr-only)
  const stageLabel = useMemo(() => {
    switch (stage) {
      case "intro":
        return "Pantalla de introducción";
      case "ritual":
        return "Ritual de 60 segundos";
      case "transition":
        return "Transición hacia el jardín";
      case "garden":
        return "Jardín interactivo";
      default:
        return "Cargando…";
    }
  }, [stage]);

  if (stage === "intro") {
    return <Intro onStart={() => setStage("ritual")} />;
  }

  if (stage === "ritual" || stage === "transition") {
    return <Ritual onComplete={() => setStage("garden")} />;
  }

  // Jardín
  return (
    <main
      id="main"
      ref={mainRef}
      className="screen-immersive"
      tabIndex={-1} // permite foco programático
      aria-label="Escena principal"
    >
      {/* Anuncio discreto de cambios de etapa para lectores de pantalla */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {stageLabel}
      </span>

      {/* Audio ambiental (montado aquí para respetar autoplay policies) */}
      <AmbientAudio src="/ambience-nature.mp3" volume={0.15} />

      {/* Escena 3D síncrona: evita el error de contexto WebGL nulo */}
      <Scene />

      {/* Overlay de UI */}
      <GardenOverlay />

      {/* Control de mute */}
      <MuteButton />
    </main>
  );
}
