// src/components/GardenHint.tsx
"use client";
import * as React from "react";

const MESSAGES = [
  "Por nada del mundo hagas click en las flores. (Probalo.)",
  "Click en las flores para ver morir algo hermoso.",
  "Probá qué pasa si tocás una flor.",
  "No hagas click en las flores. En serio.",
];

export default function GardenHint({
  seconds = 4,
  autoRotateMs = 0, // poné 4000 si querés que cambie cada 4s
}: {
  seconds?: number;
  autoRotateMs?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [msgIdx, setMsgIdx] = React.useState(
    Math.floor(Math.random() * MESSAGES.length)
  );

  // Mostrar popup al entrar
  React.useEffect(() => {
    setOpen(true);
    const t = setTimeout(() => setOpen(false), seconds * 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  // Rotación opcional entre frases
  React.useEffect(() => {
    if (!autoRotateMs) return;
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length);
    }, autoRotateMs);
    return () => clearInterval(id);
  }, [autoRotateMs]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        top: "58%",
        transform: "translate(-50%, -50%)",
        zIndex: 60,
        pointerEvents: "auto",
        background: "rgba(18, 39, 230, 0.60)",
        color: "#fff",
        borderRadius: 8,
        boxShadow:
          "0 12px 30px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,.22)",
        backdropFilter: "blur(1.5px)",
        width: "min(860px, 88vw)",
        minHeight: 56,
        padding: "16px 52px 16px 24px",
      }}
    >
      <button
        aria-label="Cerrar"
        onClick={() => setOpen(false)}
        style={{
          position: "absolute",
          right: -12,
          top: -12,
          width: 28,
          height: 28,
          borderRadius: 999,
          background: "rgba(18,39,230,.80)",
          border: "1px solid rgba(255,255,255,.75)",
          color: "#fff",
          cursor: "pointer",
          lineHeight: 1,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,.25)",
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 600,
            transform: "translateY(-1px)",
            userSelect: "none",
          }}
        >
          ×
        </span>
      </button>

      <div
        className="font-mono"
        style={{
          fontWeight: 400,
          fontSize: "clamp(16px, 1.6vw, 20px)",
          letterSpacing: "0.015em",
          userSelect: "none",
          textAlign: "left",
          textShadow: "0 1px 2px rgba(0,0,0,.25)",
        }}
      >
        {MESSAGES[msgIdx]}
      </div>
    </div>
  );
}
