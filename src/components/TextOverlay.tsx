"use client";

import React, { useMemo, useEffect, useState } from "react";
import Image from "next/image";

type Props = { progress: number };

/* ───────── helpers ───────── */
function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function easeOutCubic(t: number) { const u = clamp01(t); return 1 - Math.pow(1 - u, 3); }

/** breakpoint simple para móviles */
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

export default function TextOverlay({ progress }: Props) {
  const phase = useMemo(() => {
    if (progress < 0.25) return "intro";
    if (progress < 0.5) return "text";
    if (progress < 0.75) return "loading";
    return "done";
  }, [progress]);

  const loadK = easeOutCubic(clamp01((progress - 0.5) / 0.25));

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "min(1100px, 92vw)",
          display: "grid",
          placeItems: "center",
          gap: 24,
        }}
      >
        {phase === "intro" ? (
          <IntroScene />
        ) : phase === "text" ? (
          <TextBlock />
        ) : phase === "loading" ? (
          <LoadingBlock k={loadK} />
        ) : (
          <DoneBlock />
        )}
      </div>

      {/* 👇 Solo en el frame de texto */}
      {phase === "text" && <CandlesFixed />}

      <ScrollHint visible={progress < 0.98} />
    </div>
  );
}

/* ───────── INTRO ───────── */
function IntroScene() {
  const size = "clamp(240px, 11vw, 280px)";
  const gap = "clamp(1px, 1vw, 1px)";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${size} auto ${size}`,
          alignItems: "center",
          justifyItems: "center",
          gap,
          transform: "translateY(-35%)",
        }}
      >
        <Image
          src="/candle.gif"
          alt="Vela izquierda"
          width={180}
          height={180}
          priority
          unoptimized
          style={{
            width: size,
            height: "auto",
            imageRendering: "pixelated",
            transform: "translateX(13%) translateY(35px)",
          }}
        />
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            transform: "translateX(2%) translateY(45px)",
          }}
        >
          <div
            className="font-mono"
            style={{
              fontWeight: 400,
              fontSize: "clamp(44px, 6.4vw, 66px)",
              color: "#ffffff",
              letterSpacing: "0.015em",
              marginBottom: "-0.15em",
              lineHeight: 0.92,
            }}
          >
            Bienvenido al
          </div>
          <div
            className="font-script"
            style={{
              fontSize: "clamp(72px, 12vw, 136px)",
              color: "#ffffff",
              whiteSpace: "nowrap",
              lineHeight: 0.8,
              marginTop: "-0.1em",
              textShadow: "0 2px 0 rgba(0,0,0,.12)",
            }}
          >
            jardín digital
          </div>
        </div>
        <Image
          src="/candle.gif"
          alt="Vela derecha"
          width={180}
          height={180}
          priority
          unoptimized
          style={{
            width: size,
            height: "auto",
            imageRendering: "pixelated",
            transform: "translateY(35px)",
          }}
        />
      </div>
    </div>
  );
}

/* ───────── VELAS FIJAS (solo en TEXT) ───────── */
function CandlesFixed() {
  const src = "/candle.gif";
  const size = "clamp(260px, 9vw, 150px)";
  const base: React.CSSProperties = {
    position: "fixed",
    top: "calc(36% + 16px)",
    transform: "translateY(-15%) translateX(10%)",
    width: size,
    height: "auto",
    pointerEvents: "none",
    imageRendering: "pixelated",
    filter: "drop-shadow(0 1px 0 rgba(255,255,255,.25))",
  };
  return (
    <>
      <Image
        src={src}
        alt="Vela"
        width={150}
        height={150}
        priority
        unoptimized
        style={{ ...base, left: "max(32px, 5vw)" }}
      />
      <Image
        src={src}
        alt="Vela"
        width={150}
        height={150}
        priority
        unoptimized
        style={{ ...base, right: "max(32px, 5vw)" }}
      />
    </>
  );
}

/* ───────── HINT ───────── */
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
          transform: "translateX(8%) translateY(-28px)",
        }}
      >
        -deslizar para abajo-
      </div>
    </div>
  );
}

/* ───────── TEXTO ───────── */
function TextBlock() {
  return (
    <div
      className="font-mono"
      style={{
        color: "#ffffff",
        fontSize: "clamp(18px, 3vw, 26px)",
        lineHeight: 1.4,
        textAlign: "left",
        width: "min(900px, 88vw)",
        transform: "translateY(5%) translateX(8%)",
      }}
    >
      <p style={{ margin: 0, whiteSpace: "pre-line" }}>
        Un lugar para despedirte de lo que ya no está:
        {"\n"}
        personas, objetos, contraseñas, vínculos, mascotas
      </p>
      <p style={{ marginTop: "1em", whiteSpace: "pre-line" }}>
        Todo lo que murió, acá puede vivir por siempre.
        {"\n"}(o quizás… no)
      </p>
    </div>
  );
}

/* ───────── CARGA ───────── */
function LoadingBlock({ k }: { k: number }) {
  const isNarrow = useIsNarrow(720);
  const candleSize = isNarrow ? "clamp(120px, 22vw, 160px)" : "clamp(270px, 11vw, 280px)";

  return (
    <div
      style={{
        width: "min(1020px, 95vw)",
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr" : `${candleSize} 1fr ${candleSize}`,
        alignItems: "center",
        justifyItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        className="font-mono"
        style={{
          gridColumn: "1 / -1",
          fontWeight: 400,
          fontSize: "clamp(16px, 2.1vw, 29px)",
          color: "#ffffff",
          letterSpacing: "0.04em",
          marginBottom: isNarrow ? "-1.2em" : "-5em",
          textAlign: "center",
        }}
      >
        CARGANDO UN MINUTO DE SILENCIO
      </div>

      <Image
        src="/candle.gif"
        alt=""
        width={120}
        height={120}
        priority
        unoptimized
        style={{
          width: candleSize,
          height: "auto",
          imageRendering: "pixelated",
          transform: isNarrow ? "none" : "translateY(-20px) translateX(-25px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          width: isNarrow ? "100%" : "115%",
          height: isNarrow ? "min(64px, 12vw)" : "min(80px, 7vw)",
          border: "3px solid #ffffff",
          background: "transparent",
          overflow: "hidden",
          transform: isNarrow ? "none" : "translateX(2%) translateY(20px)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.max(2, Math.floor(k * 100))}%`,
            background: "#ffffff",
            transition: "width .25s ease",
          }}
        />
      </div>

      <Image
        src="/candle.gif"
        alt=""
        width={120}
        height={120}
        priority
        unoptimized
        style={{
          width: candleSize,
          height: "auto",
          imageRendering: "pixelated",
          transform: isNarrow ? "none" : "translateY(-20px) translateX(70px)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

/* ───────── COMPLETADO (idéntico a CARGA en medidas/offsets) ───────── */
function DoneBlock() {
  const isNarrow = useIsNarrow(720);
  const candleSize = isNarrow ? "clamp(120px, 22vw, 160px)" : "clamp(270px, 11vw, 280px)";

  return (
    <div
      style={{
        width: "min(1020px, 95vw)",
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr" : `${candleSize} 1fr ${candleSize}`,
        alignItems: "center",
        justifyItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        className="font-mono"
        style={{
          gridColumn: "1 / -1",
          fontWeight: 400,
          fontSize: "clamp(16px, 2.1vw, 29px)",
          color: "#ffffff",
          letterSpacing: "0.04em",
          marginBottom: isNarrow ? "-1.2em" : "-5em", // 🔁 igual que Loading
          textAlign: "center",
        }}
      >
        SILENCIO COMPLETADO
      </div>

      <Image
        src="/candle.gif"
        alt=""
        width={120}
        height={120}
        priority
        unoptimized
        style={{
          width: candleSize,
          height: "auto",
          imageRendering: "pixelated",
          transform: isNarrow ? "none" : "translateY(-20px) translateX(-25px)", // 🔁 igual
          pointerEvents: "none",
        }}
      />

      {/* barra llena con EXACTO ancho/alto/offset de la barra de carga */}
      <div
        style={{
          width: isNarrow ? "100%" : "115%",
          height: isNarrow ? "min(64px, 12vw)" : "min(80px, 7vw)",
          border: "3px solid #ffffff",
          background: "#ffffff",
          overflow: "hidden",
          transform: isNarrow ? "none" : "translateX(2%) translateY(20px)", // 🔁 igual
          borderRadius: 6,
        }}
      />

      <Image
        src="/candle.gif"
        alt=""
        width={120}
        height={120}
        priority
        unoptimized
        style={{
          width: candleSize,
          height: "auto",
          imageRendering: "pixelated",
          transform: isNarrow ? "none" : "translateY(-20px) translateX(70px)", // 🔁 igual
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
