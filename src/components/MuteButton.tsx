// app/components/MuteButton.tsx
"use client";

import { useAppStore } from "@/store/useAppStore";

export default function MuteButton() {
  const { muted, toggleMute } = useAppStore();

  return (
    <button
      type="button"
      className="mute-btn"
      onClick={toggleMute}
      aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
      aria-pressed={muted}
      aria-live="polite"
      title={muted ? "Activar sonido" : "Silenciar sonido"}
    >
      <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
