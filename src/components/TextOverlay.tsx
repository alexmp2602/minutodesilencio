"use client";

import React, { useMemo, useEffect, useState } from "react";
import Image from "next/image";

/* ───────── helpers ───────── */
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => {
  const u = clamp01(t);
  return 1 - Math.pow(1 - u, 3);
};
function useIsNarrow(breakpoint = 720) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width:${breakpoint}px)`);
    const on = () => setNarrow(mql.matches);
    on();
    mql.addEventListener?.("change", on);
    return () => mql.removeEventListener?.("change", on);
  }, [breakpoint]);
  return narrow;
}
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => void setM(true), []);
  return m;
}

// ── tamaños de la barra (más finita)
const BAR_H_NARROW = "min(20px, 5vw)"; // mobile
const BAR_H_WIDE = "min(66px, 5vw)"; // desktop
const BAR_BORDER = "6px solid #fff";

/** Reasigna el scroll a secciones con pesos distintos.
 *  Queremos: intro 10% · text 20% · loading 50% · done 20%
 */
function warpProgress(
  p: number,
  weights = [0.06, 0.5, 0.8, 0.5],
  logical = [0.25, 0.25, 0.25, 0.25]
) {
  const total = weights.reduce((a, b) => a + b, 0);
  const w = weights.map((v) => v / total);

  const inCum = [0, w[0], w[0] + w[1], w[0] + w[1] + w[2], 1];
  const ltot = logical.reduce((a, b) => a + b, 0);
  const l = logical.map((v) => v / ltot);
  const outCum = [0, l[0], l[0] + l[1], l[0] + l[1] + l[2], 1];

  if (p <= inCum[1])
    return (
      outCum[0] +
      (p - inCum[0]) * ((outCum[1] - outCum[0]) / (inCum[1] - inCum[0]))
    );
  if (p <= inCum[2])
    return (
      outCum[1] +
      (p - inCum[1]) * ((outCum[2] - outCum[1]) / (inCum[2] - inCum[1]))
    );
  if (p <= inCum[3])
    return (
      outCum[2] +
      (p - inCum[2]) * ((outCum[3] - outCum[2]) / (inCum[3] - inCum[2]))
    );
  return (
    outCum[3] +
    (p - inCum[3]) * ((outCum[4] - outCum[3]) / (inCum[4] - inCum[3]))
  );
}

/* ───────── Backdrop azul ───────── */
function BlueBackdrop({ opacity = 1 }: { opacity?: number }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#1227e6", // azul de intro
        zIndex: 0,
        pointerEvents: "none",
        opacity,
      }}
    />
  );
}

/* ───────── principal ───────── */
export default function TextOverlay({ progress }: { progress: number }) {
  const mounted = useMounted();
  const p = warpProgress(progress);

  const phase = useMemo(() => {
    if (p < 0.25) return "intro";
    if (p < 0.5) return "text";
    if (p < 0.75) return "loading";
    return "done";
  }, [p]);

  const loadK = easeOutCubic(clamp01((p - 0.5) / 0.25));

  // Opacidad del backdrop: 1 siempre, excepto en "done" donde hace fade 1→0
  const doneK = clamp01((p - 0.75) / 0.25); // 0..1 dentro de "done"
  const backdropOpacity = phase === "done" ? 1 - easeOutCubic(doneK) : 1;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2, // por encima del Canvas
        pointerEvents: "none",
        display: "grid",
        placeItems: "center",
      }}
    >
      {/* Fondo azul sólido (con fade-out al final) */}
      <BlueBackdrop opacity={backdropOpacity} />

      {/* Evita FOUC: muestro el zócalo cuando montó el cliente */}
      {mounted && <MarqueeBorder />}

      <div
        style={{
          width: "min(1100px, 92vw)",
          display: "grid",
          placeItems: "center",
          gap: 24,
          position: "relative",
          zIndex: 1, // por encima del backdrop
        }}
      >
        {phase === "loading" ? (
          <LoadingBlock k={loadK} />
        ) : phase === "done" ? (
          <DoneBlock />
        ) : (
          <HashtagScene />
        )}
      </div>

      {(phase === "intro" || phase === "text") && <CandlesFixed />}
      <ScrollHint visible={p < 0.98} />
    </div>
  );
}

/* ───────── “a todos aquellos” + #QEPD/#qepd ───────── */
function HashtagScene() {
  const [upper, setUpper] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setUpper((v) => !v), 150);
    return () => clearInterval(id);
  }, []);
  const hashtag = upper ? "#QEPD" : "#qepd";

  return (
    <div
      style={{
        textAlign: "center",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: "translateY(-10%)",
      }}
    >
      <p
        className="font-mono"
        style={{
          fontSize: "clamp(22px,2.5vw,32px)",
          opacity: 0.9,
          marginBottom: "0.6em",
        }}
      >
        a todos aquellos
      </p>
      <h1
        style={{
          fontFamily: "var(--font-title, sans-serif)",
          fontWeight: 700,
          fontSize: "clamp(64px,10vw,100px)",
          letterSpacing: "0.02em",
          lineHeight: 0.75,
          textShadow: "0 2px 10px rgba(0,0,0,.25)",
        }}
      >
        {hashtag}
      </h1>
    </div>
  );
}

/* ───────── velas fijas ───────── */
function CandlesFixed() {
  const src = "/candle.gif";
  const size = "clamp(250px, 9vw, 220px)";
  const base: React.CSSProperties = {
    position: "fixed",
    top: "46%",
    transform: "translateY(-50%)",
    width: size,
    height: "auto",
    pointerEvents: "none",
    imageRendering: "pixelated",
  };
  return (
    <>
      <Image
        src={src}
        alt="Vela"
        width={200}
        height={200}
        unoptimized
        priority
        style={{ ...base, left: "22vw" }}
      />
      <Image
        src={src}
        alt="Vela"
        width={200}
        height={200}
        unoptimized
        priority
        style={{ ...base, right: "20vw" }}
      />
    </>
  );
}

/* ───────── loader animado ───────── */
function LoadingBlock({ k }: { k: number }) {
  const isNarrow = useIsNarrow(720);
  return (
    <div
      style={{
        width: "min(1020px,61vw)",
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr" : "180px 1fr 180px",
        alignItems: "center",
        justifyItems: "center",
        pointerEvents: "none",
      }}
    >
      <p
        className="font-mono"
        style={{
          gridColumn: "1 / -1",
          fontWeight: 400,
          fontSize: "clamp(18px,2.4vw,27px)",
          color: "#fff",
          letterSpacing: "0.04em",
          marginBottom: isNarrow ? "-1em" : "-3em",
          textAlign: "center",
        }}
      >
        CARGANDO UN MINUTO DE SILENCIO
      </p>

      <Image
        src="/candle.gif"
        alt=""
        width={180}
        height={180}
        unoptimized
        style={{
          imageRendering: "pixelated",
          transform: "translateY(-12px) translateX(-60px) scale(1.3)",
        }}
      />

      <div
        style={{
          width: isNarrow ? "100%" : "115%",
          height: isNarrow ? BAR_H_NARROW : BAR_H_WIDE,
          border: BAR_BORDER,
          background: "transparent",
          overflow: "hidden",
          transform: "translateY(20px)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.floor(k * 100)}%`,
            background: "#fff",
            transition: "width .3s ease",
          }}
        />
      </div>

      <Image
        src="/candle.gif"
        alt=""
        width={180}
        height={180}
        unoptimized
        style={{
          imageRendering: "pixelated",
          transform: "translateY(-12px) translateX(90px) scale(1.3)",
        }}
      />
    </div>
  );
}

/* ───────── completado ───────── */
function DoneBlock() {
  const isNarrow = useIsNarrow(720);
  return (
    <div
      style={{
        width: "min(1020px,61vw)",
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr" : "180px 1fr 180px",
        alignItems: "center",
        justifyItems: "center",
        pointerEvents: "none",
      }}
    >
      <p
        className="font-mono"
        style={{
          gridColumn: "1 / -1",
          fontWeight: 400,
          fontSize: "clamp(18px,2.4vw,27px)",
          color: "#fff",
          letterSpacing: "0.04em",
          marginBottom: isNarrow ? "-1em" : "-3em",
          textAlign: "center",
        }}
      >
        SILENCIO COMPLETADO
      </p>

      <Image
        src="/candle.gif"
        alt=""
        width={180}
        height={180}
        unoptimized
        style={{
          imageRendering: "pixelated",
          transform: "translateY(-12px) translateX(-60px) scale(1.3)",
        }}
      />

      <div
        style={{
          width: isNarrow ? "100%" : "115%",
          height: isNarrow ? BAR_H_NARROW : BAR_H_WIDE,
          border: BAR_BORDER,
          background: "#ffffff",
          overflow: "hidden",
          transform: "translateY(20px)",
        }}
      />

      <Image
        src="/candle.gif"
        alt=""
        width={180}
        height={180}
        unoptimized
        style={{
          imageRendering: "pixelated",
          transform: "translateY(-12px) translateX(90px) scale(1.3)",
        }}
      />
    </div>
  );
}

/* ───────── zócalos ───────── */
function MarqueeBorder() {
  const phrase = "#queenpazdescansen🕊️🙏 ";
  const line = Array.from({ length: 20 }).map((_, i) => (
    <span key={i} className="pill">
      {phrase}
    </span>
  ));
  return (
    <>
      <div className="marquee top">
        <div className="inner">
          {line}
          {line}
        </div>
      </div>
      <div className="marquee left">
        <div className="inner">
          {line}
          {line}
        </div>
      </div>
      <div className="marquee right">
        <div className="inner">
          {line}
          {line}
        </div>
      </div>
      <style jsx>{`
        .marquee {
          position: fixed;
          color: #fff;
          font-size: clamp(12px, 1.5vw, 16px);
          text-transform: lowercase;
          opacity: 0.9;
          pointer-events: none;
          white-space: nowrap;
        }
        .top {
          top: 0;
          left: 0;
          right: 0;
          height: 26px;
          border-bottom: 3px solid rgba(255, 255, 255, 1);
          padding-bottom: 26px;
        }
        .top .inner {
          display: inline-block;
          animation: scrollX 18s linear infinite;
        }
        .left,
        .right {
          top: 0;
          bottom: 0;
          width: 24px;
          writing-mode: vertical-rl;
        }
        .left {
          left: 10px;
          border-right: 3px solid rgba(255, 255, 255, 1);
          padding-right: 6px;
        }
        .right {
          right: 6px;
          border-left: 3px solid rgba(255, 255, 255, 1);
          padding-left: 26px;
        }
        .left .inner,
        .right .inner {
          display: inline-block;
          animation: scrollY 22s linear infinite;
        }
        .pill {
          display: inline-block;
          padding: 2px 8px;
          border: 1px solid #fff;
          border-radius: 999px;
          margin-inline: 6px;
        }
        @keyframes scrollX {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @keyframes scrollY {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-50%);
          }
        }
      `}</style>
    </>
  );
}

/* ───────── hint ───────── */
function ScrollHint({ visible }: { visible: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(16px, calc(16px + var(--sa-b)))",
        transform: "translateX(-50%)",
        opacity: visible ? 1 : 0,
        transition: "opacity .2s ease",
        pointerEvents: "none",
      }}
    >
      <div
        className="font-mono"
        style={{
          fontWeight: 300,
          fontSize: "clamp(16px, 2.2vw, 25px)",
          letterSpacing: "0.02em",
          color: "#ffffff",
          opacity: 0.9,
          textShadow: "0 1px 2px rgba(0,0,0,.18), 0 0 12px rgba(0,0,0,.12)",
          userSelect: "none",
          transform: "translateY(-28px)",
        }}
      >
        -deslizar para abajo-
      </div>
    </div>
  );
}
