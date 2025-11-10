//src/components/TextOverlay.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import Image from "next/image";
import AmbientAudio from "@/components/AmbientAudio";
import { useMute } from "@/hooks/useMute";
import useSfx from "@/hooks/useSfx";
import InteractiveFlower from "@/components/InteractiveFlower";

/* Utils */
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => {
    setM(true);
  }, []);
  return m;
}
function useIsNarrow(bp = 900): boolean {
  const [n, set] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(`(max-width:${bp}px)`);
    const fn = () => set(q.matches);
    fn();
    q.addEventListener("change", fn);
    return () => q.removeEventListener("change", fn);
  }, [bp]);
  return n;
}

/** Mapea el progreso de scroll a fases lógicas */
function warpProgress(
  p: number,
  weights: [number, number, number, number] = [0.06, 0.5, 0.8, 0.5],
  logical: [number, number, number, number] = [0.25, 0.25, 0.25, 0.25]
): number {
  const sum = (a: number, b: number) => a + b;
  const w = weights.map((v) => v / weights.reduce(sum, 0));
  const l = logical.map((v) => v / logical.reduce(sum, 0));
  const inCum = [0, w[0], w[0] + w[1], w[0] + w[1] + w[2], 1];
  const outCum = [0, l[0], l[0] + l[1], l[0] + l[2], 1];
  const seg = (i: 0 | 1 | 2 | 3) =>
    outCum[i] +
    (p - inCum[i]) * ((outCum[i + 1] - outCum[i]) / (inCum[i + 1] - inCum[i]));
  if (p <= inCum[1]) return seg(0);
  if (p <= inCum[2]) return seg(1);
  if (p <= inCum[3]) return seg(2);
  return seg(3);
}

function BlueBackdrop({ opacity = 1 }: { opacity?: number }) {
  const style: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "#1227e6",
    zIndex: 0,
    pointerEvents: "none",
    opacity,
  };
  return <div style={style} />;
}

export default function TextOverlay({ progress }: { progress: number }) {
  const mounted = useMounted();
  const p = warpProgress(progress);
  const { muted } = useMute();
  const { play } = useSfx();

  // ⬇️ NUEVO: estado de completado + fade
  const [completed, setCompleted] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const fadeRef = useRef<number | null>(null);

  const phase = useMemo<"intro" | "text" | "loading" | "done">(() => {
    if (completed) return "done"; // ⬅️ fuerza done si ya se completó
    if (p < 0.25) return "intro";
    if (p < 0.5) return "text";
    if (p < 0.75) return "loading";
    return "done";
  }, [p, completed]);

  const doneK = clamp01((p - 0.75) / 0.25);
  const backdropOpacity = phase === "done" ? 1 - easeOutCubic(doneK) : 1;
  const ambientVolume = 0.18 * (phase === "done" ? 1 - easeOutCubic(doneK) : 1);

  // sfx al entrar en "loading"
  const prevPhase = useRef<"intro" | "text" | "loading" | "done" | null>(null);
  useEffect(() => {
    if (!muted && phase === "loading" && prevPhase.current !== "loading") {
      play("choir", { volume: 0.6 });
    }
    prevPhase.current = phase;
  }, [phase, muted, play]);

  // ⬇️ NUEVO: escucha el evento del loader, hace fade y auto-avanza
  useEffect(() => {
    const onDone = () => {
      if (completed) return;
      setCompleted(true);

      // auto-scroll un poco para "avanzar"
      const target = Math.max(window.scrollY, window.innerHeight * 0.92);
      window.scrollTo({ top: target, behavior: "smooth" });

      // fade-out visual del overlay
      setFadeOut(true);
      fadeRef.current = window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("ui:overlay:dismissed"));
      }, 650);
    };

    window.addEventListener("silence:completed", onDone as EventListener);
    return () => {
      window.removeEventListener("silence:completed", onDone as EventListener);
      if (fadeRef.current) window.clearTimeout(fadeRef.current);
    };
  }, [completed]);

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
        opacity: fadeOut ? 0 : 1, // ⬅️ NUEVO
        transition: "opacity .55s ease", // ⬅️ NUEVO
      }}
    >
      <AmbientAudio
        src="/audio/digital-highway-73608.mp3"
        volume={ambientVolume}
        fadeMs={320}
        pauseOnHidden
      />
      <BlueBackdrop opacity={backdropOpacity} />

      {mounted && <MarqueeBorder strong />}

      <div
        style={{
          width: "min(1200px, 94vw)",
          position: "relative",
          zIndex: 1,
          display: "grid",
          placeItems: "center",
          gap: 24,
        }}
      >
        {phase === "loading" ? (
          <PressHoldLoader />
        ) : phase === "done" ? (
          <DoneBlock />
        ) : (
          <HeroWithFlower />
        )}
      </div>

      <ScrollHint visible={p < 0.98} />
    </div>
  );
}

/* ---------- HERO: hashtag + flor ---------- */
function HeroWithFlower() {
  const isNarrow = useIsNarrow();
  const [showHint, setShowHint] = useState(false);
  const [upper, setUpper] = useState(true);

  useEffect(() => {
    const id = window.setInterval(() => setUpper((v) => !v), 150);
    return () => window.clearInterval(id);
  }, []);

  const hashtag = upper ? "#QEPD" : "#qepd";

  return (
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr" : "1fr minmax(300px, 460px)",
        alignItems: "center",
        gap: 24,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          color: "#fff",
          textAlign: isNarrow ? "center" : "left",
          paddingLeft: isNarrow ? 0 : "28vw",
          position: "relative",
        }}
      >
        {/* 👇 Vela a la izquierda (solo desktop/anchos) */}
        {!isNarrow && (
          <Image
            src="/candle.gif"
            alt=""
            width={180}
            height={180}
            unoptimized
            style={{
              position: "absolute",
              left: "220px",
              top: "50%",
              transform: "translateY(-42%)",
              imageRendering: "pixelated",
              pointerEvents: "none",
              filter: "drop-shadow(0 6px 14px rgba(0,0,0,.35))",
            }}
          />
        )}

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
            fontSize: "clamp(64px,6.2vw,100px)",
            letterSpacing: "0.02em",
            lineHeight: 0.75,
            textShadow: "0 2px 10px rgba(0,0,0,.25)",
          }}
        >
          {hashtag}
        </h1>
      </div>

      <div
        style={{
          height: isNarrow ? 300 : 380,
          pointerEvents: "auto",
          position: "relative",
        }}
      >
        <InteractiveFlower
          scale={1}
          position={[0, 0, 0]}
          onHint={setShowHint}
        />
        {showHint && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 8,
              transform: "translateX(-70%)",
              background: "rgba(255,255,255,.15)",
              color: "#fff",
              padding: "6px 10px",
              borderRadius: 999,
              fontSize: 13,
              backdropFilter: "blur(6px)",
              pointerEvents: "none",
            }}
          >
            Hacé click en los pétalos
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Loader: “presionar y mantener” ---------- */
function PressHoldLoader() {
  const [k, setK] = useState(0); // 0..1
  const [holding, setHolding] = useState(false);
  const raf = useRef<number | null>(null);
  const firedRef = useRef(false); // ⬅️ NUEVO: evita múltiples disparos

  const tick = useCallback(() => {
    setK((v) => {
      const speedUp = 0.008;
      const speedDown = 0.004;
      return clamp01(v + (holding ? speedUp : -speedDown));
    });
    raf.current = window.requestAnimationFrame(tick);
  }, [holding]);

  useEffect(() => {
    raf.current = window.requestAnimationFrame(tick);
    return () => {
      if (raf.current) window.cancelAnimationFrame(raf.current);
    };
  }, [tick]);

  useEffect(() => {
    if (k >= 1 && !firedRef.current) {
      firedRef.current = true; // ⬅️ asegura “una sola vez”
      window.dispatchEvent(new CustomEvent("silence:completed"));
    }
  }, [k]);

  const barH = "min(66px, 6vw)";

  const onDown = () => setHolding(true);
  const onUp = () => setHolding(false);

  return (
    <div
      style={{
        width: "min(1050px, 80vw)",
        display: "grid",
        gridTemplateColumns: "180px 1fr 180px",
        alignItems: "center",
        justifyItems: "center",
        gap: 16,
        pointerEvents: "none",
      }}
    >
      <p
        className="font-mono"
        style={{ gridColumn: "1 / -1", color: "#fff", letterSpacing: "0.04em" }}
      >
        MANTENÉ APRETADO PARA CARGAR EL SILENCIO
      </p>

      <Image
        src="/candle.gif"
        alt=""
        width={180}
        height={180}
        unoptimized
        style={{ imageRendering: "pixelated" }}
      />

      <div
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={onUp}
        style={{
          width: "115%",
          height: barH,
          border: "6px solid #fff",
          background: "transparent",
          overflow: "hidden",
          pointerEvents: "auto",
          touchAction: "none",
          userSelect: "none",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${Math.floor(easeOutCubic(k) * 100)}%`,
            background: "#fff",
            transition: holding ? "none" : "width .18s ease",
          }}
        />
      </div>

      <Image
        src="/candle.gif"
        alt=""
        width={180}
        height={180}
        unoptimized
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}

/* ---------- Completado ---------- */
function DoneBlock() {
  return (
    <div style={{ color: "#fff", textAlign: "center", pointerEvents: "none" }}>
      <p className="font-mono" style={{ fontSize: "clamp(18px,2.4vw,27px)" }}>
        SILENCIO COMPLETADO
      </p>
    </div>
  );
}

/* ---------- Zócalos ---------- */
function MarqueeBorder({ strong = false }: { strong?: boolean }) {
  const phrase = "#queenpazdescansen🕊️🙏 ";
  const items = Array.from({ length: 24 }, (_, i) => (
    <span key={i} className="pill">
      {phrase}
    </span>
  ));
  return (
    <>
      <div className="marquee top">
        <div className="inner">
          {items}
          {items}
        </div>
      </div>
      <div className="marquee left">
        <div className="inner">
          {items}
          {items}
        </div>
      </div>
      <div className="marquee right">
        <div className="inner">
          {items}
          {items}
        </div>
      </div>
      <style jsx>{`
        .marquee {
          position: fixed;
          color: #fff;
          font-size: clamp(13px, 1.6vw, 18px);
          opacity: 0.95;
          pointer-events: none;
          white-space: nowrap;
        }
        .top {
          top: 0;
          left: 0;
          right: 0;
          height: ${strong ? "38px" : "26px"};
          border-bottom: 4px solid #fff;
          padding-bottom: ${strong ? "30px" : "22px"};
        }
        .top .inner {
          display: inline-block;
          animation: scrollX 18s linear infinite;
        }
        .left,
        .right {
          top: 0;
          bottom: 0;
          width: ${strong ? "36px" : "24px"};
          writing-mode: vertical-rl;
        }
        .left {
          left: 10px;
          border-right: 4px solid #fff;
          padding-right: ${strong ? "12px" : "6px"};
        }
        .right {
          right: 6px;
          border-left: 4px solid #fff;
          padding-left: ${strong ? "30px" : "26px"};
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
          background: rgba(255, 255, 255, 0.06);
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

/* ---------- Hint scroll ---------- */
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
          color: "#fff",
        }}
      >
        -deslizar para abajo-
      </div>
    </div>
  );
}
