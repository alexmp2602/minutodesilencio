"use client";

import * as React from "react";

type Props = {
  /** Progreso de visibilidad 0..1 de la sección (viene de useSectionProgress) */
  visibleK: number;
  /** duración en ms (default 60000 = 60s) */
  durationMs?: number;
  /** callback al completar (opcional) */
  onComplete?: () => void;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (t: number) => {
  const u = clamp01(t);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
};

/** congela el scroll del documento mientras esté activo */
function useScrollLock(lock: boolean) {
  React.useEffect(() => {
    if (!lock) return;
    const scrollY = window.scrollY;
    const prevOverflow = document.documentElement.style.overflow;
    const prevPos = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;

    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    const prevent = (e: Event) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      const nav = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        " ",
      ];
      if (nav.includes(e.key)) e.preventDefault();
    };

    window.addEventListener("wheel", prevent, { passive: false });
    window.addEventListener("touchmove", prevent, { passive: false });
    window.addEventListener("keydown", onKey);

    return () => {
      document.documentElement.style.overflow = prevOverflow;
      document.body.style.position = prevPos;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior });

      window.removeEventListener("wheel", prevent);
      window.removeEventListener("touchmove", prevent);
      window.removeEventListener("keydown", onKey);
    };
  }, [lock]);
}

export default function MinuteRitual({
  visibleK,
  durationMs = 60000,
  onComplete,
}: Props) {
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [k, setK] = React.useState(0); // progreso 0..1 del minuto
  const startRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);

  // ⚠️ NO leer matchMedia en render (causa mismatch).
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(!!m?.matches);
    update();
    m?.addEventListener?.("change", update);
    return () => m?.removeEventListener?.("change", update);
  }, []);

  // Halo “respiratorio”: animado por rAF en estado (no en render).
  const [breath, setBreath] = React.useState(0); // 0..1
  React.useEffect(() => {
    if (reduced) return; // respetar reduced motion
    let raf: number | null = null;
    const loop = () => {
      // 3s por ciclo
      const t = (performance.now() % 3000) / 3000;
      setBreath(easeInOut(t));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Auto-inicio cuando la sección es visible.
  React.useEffect(() => {
    if (!running && !done && visibleK > 0.1) {
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleK]);

  // bloquear scroll mientras corre
  useScrollLock(running && !done);

  const start = React.useCallback(() => {
    if (running || done) return;
    setRunning(true);
    startRef.current = performance.now();
    const tick = () => {
      const t0 = startRef.current!;
      const now = performance.now();
      const raw = (now - t0) / durationMs;
      const kk = clamp01(raw);
      setK(kk);
      if (kk < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDone(true);
        setRunning(false);
        onComplete?.();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [running, done, durationMs, onComplete]);

  React.useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const secondsLeft = Math.ceil((1 - k) * (durationMs / 1000));

  // ring SVG
  const R = 118; // radio del aro exterior
  const CIRC = 2 * Math.PI * R;
  const dash = CIRC * k;

  const copy = React.useMemo(() => {
    if (!running && !done) return "Preparáte… el minuto comienza.";
    if (k < 0.33) return "Respirá. Permití que aparezca lo que haya.";
    if (k < 0.66) return "Nombrá en silencio aquello que despedís.";
    if (k < 0.98) return "Agradecé. Soltá.";
    return "Gracias.";
  }, [running, done, k]);

  return (
    <div
      className="min-ritual"
      aria-live="polite"
      style={{
        width: "min(560px, 92vw)",
        display: "grid",
        justifyItems: "center",
        gap: 18,
      }}
    >
      {/* Aro/sol suave */}
      <div
        aria-hidden
        style={{
          position: "relative",
          width: 260,
          height: 260,
          borderRadius: "50%",
          boxShadow:
            "0 8px 30px rgba(0,0,0,.18), inset 0 0 0 1px rgba(255,255,255,.28)",
          background:
            "radial-gradient( circle at 50% 50%, rgba(255,244,214,.9) 0%, rgba(255,255,255,.55) 48%, rgba(255,255,255,.15) 66%, transparent 72% )",
        }}
      >
        {/* halo respiratorio (estado → sin mismatch) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${1 + (reduced ? 0 : breath * 0.04)})`,
            transition: reduced ? undefined : "transform .25s linear",
            borderRadius: "50%",
            filter: "blur(12px)",
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,.55) 0%, rgba(255,255,255,.16) 60%, transparent 72%)",
          }}
        />

        {/* progreso */}
        <svg
          viewBox="0 0 260 260"
          width={260}
          height={260}
          style={{ position: "absolute", inset: 0 }}
          aria-hidden
        >
          <circle
            cx="130"
            cy="130"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,.45)"
            strokeWidth="3"
          />
          <circle
            cx="130"
            cy="130"
            r={R}
            fill="none"
            stroke="rgba(61,105,204,.9)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC - dash}`}
            transform="rotate(-90 130 130)"
          />
        </svg>

        {/* contador grande */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-serif, serif)",
            color: "var(--blue-french, #365ec7)",
            fontStyle: "italic",
            textShadow:
              "0 2px 6px rgba(0,0,0,.22), 0 0 12px rgba(255,255,255,.32)",
            fontSize: "clamp(28px, 7vw, 44px)",
            letterSpacing: 1,
          }}
        >
          {`${secondsLeft.toString().padStart(2, "0")}s`}
        </div>
      </div>

      {/* texto guía */}
      <div
        className="font-serif"
        style={{
          textAlign: "center",
          fontStyle: "italic",
          fontSize: "clamp(15px, 2.2vw, 20px)",
          color: "var(--blue-french)",
          opacity: 0.95,
          textShadow:
            "0 1px 2px rgba(0,0,0,.18), 0 0 10px rgba(255,255,255,.28)",
          minHeight: 24,
        }}
      >
        {copy}
      </div>

      {/* hint final */}
      {done && (
        <div
          className="font-serif"
          style={{
            textAlign: "center",
            fontStyle: "italic",
            fontSize: "clamp(13px, 1.9vw, 17px)",
            color: "var(--blue-french)",
            opacity: 0.9,
          }}
        >
          Bajá para continuar hacia el jardín.
        </div>
      )}
    </div>
  );
}
