"use client";
import React, { useEffect, useRef } from "react";

export default function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;

    const speed = 0.16; // suavidad del movimiento

    const onMove = (e: MouseEvent) => {
      tx = e.clientX - 10;
      ty = e.clientY - 10;
    };

    const loop = () => {
      x += (tx - x) * speed;
      y += (ty - y) * speed;
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
    };
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
          transform: "translate3d(0,0,0)",
        }}
      />

      <style jsx global>{`
        * {
          cursor: none;
        }
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
