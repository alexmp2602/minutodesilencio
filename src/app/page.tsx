"use client";

import Intro from "@/components/Intro";
import Ritual from "@/components/Ritual";
import Scene from "@/components/Scene";
import GardenOverlay from "@/components/GardenOverlay";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";
import { useAppStore } from "@/store/useAppStore";

/**
 * HomePage maneja el flujo principal:
 * Intro → Ritual (60s) → Garden (escena 3D).
 * El estado de fase se controla con Zustand (store global).
 */
export default function HomePage() {
  const { stage, setStage } = useAppStore();

  // Intro
  if (stage === "intro") {
    return <Intro onStart={() => setStage("ritual")} />;
  }

  // Ritual (al terminar pasa a transición y luego a garden)
  if (stage === "ritual" || stage === "transition") {
    return <Ritual onComplete={() => setStage("garden")} />;
  }

  // Garden
  return (
    <section className="screen-immersive">
      {/* Audio global: maneja crossfade según stage */}
      <AmbientAudio src="/ambience-nature.mp3" volume={0.15} />
      <Scene />
      <GardenOverlay />
      <button
        className="skip-btn"
        onClick={() => setStage("intro")}
        aria-label="Volver al inicio"
      >
        ⏭
      </button>
      <MuteButton />
    </section>
  );
}
