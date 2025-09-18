"use client";

import Intro from "@/components/Intro";
import Ritual from "@/components/Ritual";
import Scene from "@/components/Scene";
import GardenOverlay from "@/components/GardenOverlay";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";
import { useAppStore } from "@/store/useAppStore";

export default function HomePage() {
  const stage = useAppStore((s) => s.stage);
  const setStage = useAppStore((s) => s.setStage);

  if (stage === "intro") return <Intro onStart={() => setStage("ritual")} />;

  if (stage === "ritual")
    return <Ritual onComplete={() => setStage("garden")} />;

  return (
    <section className="screen-immersive">
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
