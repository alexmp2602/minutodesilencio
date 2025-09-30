// app/components/MuteButton.tsx
"use client";

import { useEffect, CSSProperties } from "react";
import { useAppStore } from "@/store/useAppStore";

type Props = {
  /** Botón flotante (abajo-derecha) o embebido */
  variant?: "floating" | "static";
  /** Atajo de teclado: M mutea/desmutea */
  hotkey?: boolean;
  /** Tamaño del botón */
  size?: "md" | "lg";
  /** Etiquetas accesibles */
  labels?: { on: string; off: string };
  /** Offset opcional cuando es floating (px) */
  offset?: { right?: number; bottom?: number };
};

export default function MuteButton({
  variant = "floating",
  hotkey = true,
  size = "md",
  labels = { on: "Silenciar sonido", off: "Activar sonido" },
  offset,
}: Props) {
  const muted = useAppStore((s) => s.muted);
  const toggleMute = useAppStore((s) => s.toggleMute);

  // Hotkey: tecla "m"
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      const isEditable =
        t?.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT";
      if (isEditable) return;
      if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, toggleMute]);

  const dim = size === "lg" ? 56 : 44; // px
  const floating: CSSProperties =
    variant === "floating"
      ? {
          position: "absolute",
          right: offset?.right ?? 14,
          bottom: offset?.bottom ?? 70,
          zIndex: 3,
        }
      : {};

  const glassy: CSSProperties = {
    width: dim,
    height: dim,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    color: "#fff",
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.18)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    boxShadow: "0 6px 18px rgba(0,0,0,.15)",
    transition: "transform .08s ease, background .15s ease, opacity .15s ease",
  };

  return (
    <button
      type="button"
      id="mute-button"
      style={{ ...floating, ...glassy }}
      onClick={toggleMute}
      aria-label={muted ? labels.off : labels.on}
      aria-pressed={muted}
      title={muted ? labels.off : labels.on}
      onPointerDown={(e) => {
        // feedback rápido
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(.96)";
      }}
      onPointerUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
      data-state={muted ? "muted" : "unmuted"}
    >
      <span aria-hidden="true" style={{ fontSize: size === "lg" ? 26 : 22 }}>
        {muted ? "🔇" : "🔊"}
      </span>
      <span className="sr-only">
        {muted ? "Sonido desactivado" : "Sonido activado"}
      </span>
    </button>
  );
}
