// src/components/TextOverlay.tsx
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

  const [completed, setCompleted] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const fadeRef = useRef<number | null>(null);

  const phase = useMemo<"intro" | "text" | "loading" | "done">(() => {
    if (completed) return "done";
    if (p < 0.25) return "intro";
    if (p < 0.5) return "text";
    if (p < 0.75) return "loading";
    return "done";
  }, [p, completed]);

  /* 👇 BLOQUEO DE SCROLL SOLO EN LA FASE DE LOADER */
  useEffect(() => {
    const shouldLock = phase === "loading" && !completed;
    if (!shouldLock) return;

    const prevent = (e: Event) => {
      e.preventDefault();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("wheel", prevent, { passive: false });
    window.addEventListener("touchmove", prevent, { passive: false });

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("wheel", prevent as EventListener);
      window.removeEventListener("touchmove", prevent as EventListener);
    };
  }, [phase, completed]);

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

  // escucha el evento del loader, hace fade y auto-avanza
  useEffect(() => {
    const onDone = () => {
      if (completed) return;
      setCompleted(true);

      const target = Math.max(window.scrollY, window.innerHeight * 0.92);
      window.scrollTo({ top: target, behavior: "smooth" });

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
        opacity: fadeOut ? 0 : 1,
        transition: "opacity .55s ease",
      }}
    >
      <AmbientAudio
        src="/audio/digital-highway-73608.mp3"
        volume={ambientVolume}
        fadeMs={320}
        pauseOnHidden
      />
      <BlueBackdrop opacity={backdropOpacity} />
      <VinesOverlay />

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

      {/* ✅ cambio: no mostrar el hint de scroll durante loading */}
      {phase !== "loading" && <ScrollHint visible={p < 0.98} />}
    </div>
  );
}

/* ---------- HERO: hashtag + flor ---------- */
function HeroWithFlower() {
  const isNarrow = useIsNarrow();
  const [showHint, setShowHint] = useState(false);
  const [upper, setUpper] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

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
        {/* Vela del hero ahora draggable */}
        {!isNarrow && (
          <DraggableCandle
            size={180}
            showHintInitially
            wrapperStyle={{
              position: "absolute",
              left: 220,
              top: "50%",
              transform: "translateY(-42%)",
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
        <div
          className={!hasInteracted ? "flowerWrap bob" : "flowerWrap"}
          onPointerDown={() => setHasInteracted(true)}
          onMouseEnter={() => setHasInteracted(true)}
          style={{ position: "relative", width: "100%", height: "100%" }}
        >
          {!hasInteracted && (
            <>
              <div className="pulseHalo" aria-hidden />
              <div className="spinRing" aria-hidden />
            </>
          )}

          <div style={{ position: "absolute", inset: 0 }}>
            <InteractiveFlower
              scale={1}
              position={[0.2, 0, 0]}
              onHint={(show) => {
                setShowHint(show);
                if (show) setHasInteracted(true);
              }}
            />
          </div>
        </div>

        {showHint && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 8,
              transform: "translateX(-50%)",
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

        <style jsx>{`
          .flowerWrap {
            position: relative;
            width: 100%;
            height: 100%;
          }
          .pulseHalo {
            position: absolute;
            inset: -60%;
            border-radius: 50%;
            background: radial-gradient(
              closest-side,
              rgba(255, 255, 255, 0.35),
              rgba(255, 255, 255, 0) 70%
            );
            filter: blur(10px);
            animation: pulse 1.8s ease-in-out infinite;
            pointer-events: none;
          }
          .spinRing {
            position: absolute;
            inset: -2%;
            border-radius: 50%;
            border: 2px dashed rgba(255, 255, 255, 0.65);
            animation: rotate 6s linear infinite;
            pointer-events: none;
            opacity: 0.8;
          }
          .bob {
            animation: bob 2.6s ease-in-out infinite;
          }
          @keyframes pulse {
            0%,
            100% {
              transform: scale(0.96);
              opacity: 0.7;
            }
            50% {
              transform: scale(1.05);
              opacity: 1;
            }
          }
          @keyframes rotate {
            to {
              transform: rotate(360deg);
            }
          }
          @keyframes bob {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-6px);
            }
          }
        `}</style>
      </div>
    </div>
  );
}

/* ---------- Loader: “presionar y mantener” ---------- */
function PressHoldLoader() {
  const [k, setK] = useState(0); // 0..1
  const [holding, setHolding] = useState(false);
  const raf = useRef<number | null>(null);
  const firedRef = useRef(false);

  const SPEED_UP = 0.0048;
  const SPEED_DOWN = 0.0025;

  const tick = useCallback(() => {
    setK((v) => clamp01(v + (holding ? SPEED_UP : -SPEED_DOWN)));
    raf.current = window.requestAnimationFrame(tick);
  }, [holding]);

  useEffect(() => {
    raf.current = window.requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [tick]);

  useEffect(() => {
    if (k >= 1 && !firedRef.current) {
      firedRef.current = true;
      window.dispatchEvent(new CustomEvent("silence:completed"));
    }
  }, [k]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("silence:progress", { detail: { k } })
    );
  }, [k]);

  const onDown = () => setHolding(true);
  const onUp = () => setHolding(false);

  const barH = "min(82px, 7.6vw)";
  const barW = "min(900px, 80vw)";
  const candle = { w: 180, h: 180 };

  return (
    <div
      style={{
        width: "min(1200px, 92vw)",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        justifyItems: "center",
        gap: 20,
        pointerEvents: "none",
      }}
    >
      {/* Vela izquierda draggable */}
      <DraggableCandle size={candle.w} />

      <div style={{ textAlign: "center", pointerEvents: "auto" }}>
        <div
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
          style={{
            width: barW,
            height: barH,
            border: "6px solid #fff",
            background: "rgba(255,255,255,.08)",
            overflow: "hidden",
            touchAction: "none",
            userSelect: "none",
            borderRadius: 16,
            boxShadow:
              "0 10px 40px rgba(0,0,0,.25), inset 0 0 0 2px rgba(255,255,255,.35)",
            marginBottom: 12,
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

        <div
          className="font-mono"
          style={{
            color: "#fff",
            fontSize: "clamp(16px, 2vw, 22px)",
            opacity: 0.92,
            letterSpacing: "0.5px",
            textShadow: "0 2px 6px rgba(0,0,0,.25)",
            pointerEvents: "none",
          }}
        >
          Mantené presionada la barra
        </div>
      </div>

      {/* Vela derecha draggable */}
      <DraggableCandle size={candle.w} />
    </div>
  );
}

/* ---------- Vela draggable reutilizable ---------- */

type DragState = {
  dragging: boolean;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
  pointerId: number | null;
  rect: DOMRect | null;
  vw: number;
  vh: number;
};

function DraggableCandle({
  size = 180,
  showHintInitially = false,
  wrapperStyle,
}: {
  size?: number;
  showHintInitially?: boolean;
  wrapperStyle?: React.CSSProperties;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [showHint, setShowHint] = useState(showHintInitially);
  const dragRef = useRef<DragState>({
    dragging: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    pointerId: null,
    rect: null,
    vw: 0,
    vh: 0,
  });

  useEffect(() => {
    if (!showHint) return;
    const id = window.setTimeout(() => setShowHint(false), 3500);
    return () => window.clearTimeout(id);
  }, [showHint]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setShowHint(false);

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();

    dragRef.current = {
      ...dragRef.current,
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
      pointerId: e.pointerId,
      rect,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };

    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.dragging || d.pointerId !== e.pointerId || !d.rect) return;

    const rawDx = e.clientX - d.startX;
    const rawDy = e.clientY - d.startY;

    // Queremos permitir movimiento libre, solo evitando que salga del viewport
    const margin = 8;

    const tryDx = rawDx;
    const tryDy = rawDy;

    // Nueva posición del rect con ese delta
    let newLeft = d.rect.left + tryDx;
    let newTop = d.rect.top + tryDy;
    let newRight = newLeft + d.rect.width;
    let newBottom = newTop + d.rect.height;

    let dx = tryDx;
    let dy = tryDy;

    // Ajustes para mantener dentro de pantalla
    if (newLeft < margin) {
      const diff = margin - newLeft;
      dx += diff;
      newLeft += diff;
      newRight += diff;
    }
    if (newRight > d.vw - margin) {
      const diff = newRight - (d.vw - margin);
      dx -= diff;
      newLeft -= diff;
      newRight -= diff;
    }
    if (newTop < margin) {
      const diff = margin - newTop;
      dy += diff;
      newTop += diff;
      newBottom += diff;
    }
    if (newBottom > d.vh - margin) {
      const diff = newBottom - (d.vh - margin);
      dy -= diff;
    }

    setPos({
      x: d.baseX + dx,
      y: d.baseY + dy,
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.dragging = false;
    if (d.pointerId != null) {
      try {
        e.currentTarget.releasePointerCapture(d.pointerId);
      } catch {}
      d.pointerId = null;
    }
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        position: wrapperStyle?.position ?? "relative",
        ...wrapperStyle,
        touchAction: "none",
        cursor: "grab",
        pointerEvents: "auto",
        transform: `${wrapperStyle?.transform ?? ""} translate3d(${pos.x}px, ${
          pos.y
        }px, 0)`.trim(),
        transition: dragRef.current.dragging ? "none" : "transform 0.12s ease",
      }}
    >
      <Image
        src="/candle.gif"
        alt=""
        width={size}
        height={size}
        unoptimized
        style={{
          imageRendering: "pixelated",
          pointerEvents: "none",
          display: "block",
        }}
      />

      {showHint && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: -14,
            transform: "translateX(-50%)",
            background: "rgba(255,255,255,0.16)",
            color: "#fff",
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 11,
            letterSpacing: "0.03em",
            backdropFilter: "blur(6px)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          Arrastrá la vela
        </div>
      )}
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

/* ---------- Ramas que crecen con el progreso ---------- */
function VinesOverlay() {
  const leftRef = useRef<SVGPathElement | null>(null);
  const rightRef = useRef<SVGPathElement | null>(null);
  const [k, setK] = useState(0); // 0..1

  useEffect(() => {
    const onP = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const v = typeof detail.k === "number" ? detail.k : 0;
      setK(Math.max(0, Math.min(1, v)));
    };
    window.addEventListener("silence:progress", onP as EventListener);
    return () =>
      window.removeEventListener("silence:progress", onP as EventListener);
  }, []);

  const dashFor = (el: SVGPathElement | null) => {
    if (!el) return 0;
    const len = el.getTotalLength();
    const eased = 1 - (1 - k) * (1 - k); // easeOutQuad
    return (1 - eased) * len;
  };

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <svg
        width="32vw"
        height="100vh"
        viewBox="0 0 320 1000"
        preserveAspectRatio="xMinYMid meet"
        style={{ position: "absolute", left: 0, top: 0, opacity: 0.9 }}
      >
        <defs>
          <linearGradient id="vineGradL" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#bfe3ff" />
            <stop offset="100%" stopColor="#e5f2ff" />
          </linearGradient>
        </defs>
        <path
          ref={leftRef}
          d="M310,990 C120,860 140,720 80,600 C30,500 50,420 60,360 C75,270 120,210 160,170 C180,150 210,130 240,120"
          fill="none"
          stroke="url(#vineGradL)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: "drop-shadow(0 6px 22px rgba(255,255,255,.18))",
            strokeDasharray: leftRef.current
              ? leftRef.current.getTotalLength()
              : 1,
            strokeDashoffset: dashFor(leftRef.current),
            transition: "stroke-dashoffset 80ms linear",
          }}
        />
        <g opacity={k}>
          <circle cx="110" cy="700" r="5" fill="#e6f5ff" />
          <circle cx="150" cy="520" r="4" fill="#e6f5ff" />
          <circle cx="185" cy="360" r="5" fill="#e6f5ff" />
        </g>
      </svg>

      <svg
        width="32vw"
        height="100vh"
        viewBox="0 0 320 1000"
        preserveAspectRatio="xMaxYMid meet"
        style={{ position: "absolute", right: 0, top: 0, opacity: 0.9 }}
      >
        <defs>
          <linearGradient id="vineGradR" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#bfe3ff" />
            <stop offset="100%" stopColor="#e5f2ff" />
          </linearGradient>
        </defs>
        <path
          ref={rightRef}
          d="M10,980 C200,860 180,740 240,610 C280,530 260,450 250,380 C235,280 200,210 160,170 C140,150 110,130 80,120"
          fill="none"
          stroke="url(#vineGradR)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: "drop-shadow(0 6px 22px rgba(255,255,255,.18))",
            strokeDasharray: rightRef.current
              ? rightRef.current.getTotalLength()
              : 1,
            strokeDashoffset: dashFor(rightRef.current),
            transition: "stroke-dashoffset 80ms linear",
          }}
        />
        <g opacity={k}>
          <circle cx="220" cy="680" r="5" fill="#e6f5ff" />
          <circle cx="170" cy="500" r="4" fill="#e6f5ff" />
          <circle cx="135" cy="330" r="5" fill="#e6f5ff" />
        </g>
      </svg>
    </div>
  );
}
