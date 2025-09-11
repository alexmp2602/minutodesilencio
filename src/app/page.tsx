"use client";

import { useState } from "react";
import Intro from "@/components/Intro";
import Ritual from "@/components/Ritual";
import Scene from "@/components/Scene";
import GardenOverlay from "@/components/GardenOverlay";
import AmbientAudio from "@/components/AmbientAudio";
import MuteButton from "@/components/MuteButton";

type Phase = "intro" | "ritual" | "garden";

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("intro");

  if (phase === "intro") return <Intro onStart={() => setPhase("ritual")} />;

  if (phase === "ritual")
    return <Ritual onComplete={() => setPhase("garden")} />;

  return (
    <section className="screen-immersive">
      <AmbientAudio src="/ambience-nature.mp3" volume={0.15} />
      <Scene />
      <GardenOverlay />
      <MuteButton />
    </section>
  );
}
