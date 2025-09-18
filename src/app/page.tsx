"use client";

import Intro from "@/components/Intro";
import Ritual from "@/components/Ritual";
import Scene from "@/components/Scene";
import GardenOverlay from "@/components/GardenOverlay";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";
import { useAppStore } from "@/store/useAppStore";

export default function HomePage() {
  const { stage, setStage } = useAppStore();

  if (stage === "intro") {
    return <Intro onStart={() => setStage("ritual")} />;
  }

  if (stage === "ritual" || stage === "transition") {
    return <Ritual onComplete={() => setStage("garden")} />;
  }

  return (
    <section className="screen-immersive">
      <AmbientAudio src="/ambience-nature.mp3" volume={0.15} />
      <Scene />
      <GardenOverlay />
      <MuteButton />
    </section>
  );
}
