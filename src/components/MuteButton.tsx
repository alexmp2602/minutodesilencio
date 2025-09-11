"use client";
import { useEffect, useState } from "react";

export default function MuteButton() {
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ambientMuted") === "1";
  });

  useEffect(() => {
    document.querySelectorAll("audio").forEach((a) => (a.muted = muted));
    localStorage.setItem("ambientMuted", muted ? "1" : "0");
  }, [muted]);

  return (
    <button
      className="skip-btn"
      style={{ right: 16, bottom: 56 }}
      aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
      onClick={() => setMuted((m) => !m)}
    >
      {muted ? "🔇" : "🔈"}
    </button>
  );
}
