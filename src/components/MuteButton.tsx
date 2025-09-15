"use client";
import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

export default function MuteButton() {
  const { muted, toggleMute } = useAppStore();

  // persistencia en localStorage
  useEffect(() => {
    localStorage.setItem("ambientMuted", muted ? "1" : "0");
  }, [muted]);

  return (
    <button
      className="mute-btn"
      aria-pressed={muted}
      aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
      onClick={toggleMute}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
