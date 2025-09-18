"use client";

import { useAppStore } from "@/store/useAppStore";

export default function MuteButton() {
  const { muted, toggleMute } = useAppStore();

  return (
    <button
      type="button"
      className="mute-btn"
      aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
      aria-pressed={muted}
      onClick={toggleMute}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
