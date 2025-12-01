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
  autoRotateMs = 0,
}: {
  autoRotateMs?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [msgIdx, setMsgIdx] = React.useState(
    Math.floor(Math.random() * MESSAGES.length)
  );

  React.useEffect(() => {
    setOpen(true);
  }, []);

  React.useEffect(() => {
    if (!autoRotateMs || !open) return;
    const id = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length);
    }, autoRotateMs);
    return () => clearInterval(id);
  }, [autoRotateMs, open]);

  const onStart = React.useCallback(() => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("ms:garden:started"));
  }, []);

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
        width: "min(700px, 88vw)",
        minHeight: 56,
        padding: "16px 24px 14px",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        className="font-mono"
        style={{
          fontWeight: 400,
          fontSize: "clamp(16px, 1.6vw, 20px)",
          letterSpacing: "0.015em",
          userSelect: "none",
          textAlign: "center",
          textShadow: "0 1px 2px rgba(0,0,0,.25)",
        }}
      >
        {MESSAGES[msgIdx]}
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          onClick={onStart}
          className="font-mono"
          style={{
            padding: "8px 22px",
            background: "#fff",
            color: "#0b0b0b",
            fontWeight: 900,
            fontSize: "clamp(14px,1.6vw,18px)",
            borderRadius: 999,
            border: "3px solid #111",
            cursor: "pointer",
            boxShadow: "0 6px 18px rgba(0,0,0,.35)",
            transition: "transform .15s ease, filter .15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(1.05)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Comenzar
        </button>
      </div>
    </div>
  );
}
