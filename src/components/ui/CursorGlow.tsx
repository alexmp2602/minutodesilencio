"use client";
import React, { useEffect, useRef } from "react";

export default function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current!;
    const move = (e: MouseEvent) => {
      el.style.transform = `translate(${e.clientX - 10}px, ${
        e.clientY - 10
      }px)`;
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <>
      <div
        ref={ref}
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: 20,
          height: 20,
          borderRadius: "50%",
          pointerEvents: "none",
          mixBlendMode: "screen",
          boxShadow:
            "0 0 12px 4px rgba(255,255,255,.35), 0 0 28px 10px rgba(18,39,230,.28)",
          filter: "blur(0.2px)",
          zIndex: 9999,
        }}
      />
      <style jsx global>{`
        * {
          cursor: none;
        } /* escondo cursor nativo */
        a,
        button,
        input,
        textarea {
          cursor: none !important;
        }
      `}</style>
    </>
  );
}
