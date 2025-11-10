"use client";
import { useCallback, useRef } from "react";
import { useMute } from "@/hooks/useMute";

type Src = { src: string; type?: string };
type Bank = {
  id: string;
  sources: Src[];
  pool: HTMLAudioElement[];
  polyphony: number;
  idx: number;
  lastAt: number;
  cooldownMs: number;
};
type PlayOpts = {
  volume?: number;
  rate?: number;
  detuneSemitones?: number;
  allowOverlap?: boolean;
};

const SUPPORTED_MIME = ["audio/mpeg", "audio/ogg", "audio/wav"];

function canPlayAny(probe: HTMLAudioElement, s: Src) {
  const type = s.type ?? "";
  if (!type) return true;
  if (!SUPPORTED_MIME.includes(type)) return false;
  return probe.canPlayType(type) !== "";
}

export default function useSfx() {
  const { muted } = useMute();

  const banks = useRef<Map<string, Bank>>(new Map());
  const didDefault = useRef(false);

  const ensureDefaults = useCallback(() => {
    if (didDefault.current) return;
    didDefault.current = true;

    // efecto al plantar (alias "plant")
    register("plant", [{ src: "/audio/plant.mp3", type: "audio/mpeg" }], {
      polyphony: 4,
      cooldownMs: 60,
    });

    // alternativa cartoon (por si querés usarlo en otras interacciones)
    register(
      "flower-pop",
      [
        {
          src: "/audio/bar-increase-cartoon-funny-jump-384919.mp3",
          type: "audio/mpeg",
        },
      ],
      { polyphony: 4, cooldownMs: 70 }
    );

    // coro para la intro
    register(
      "choir",
      [{ src: "/audio/angelic-choir-intro-257473.mp3", type: "audio/mpeg" }],
      { polyphony: 1, cooldownMs: 300 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickSupported = (sources: Src[]) => {
    const probe = document.createElement("audio");
    for (const s of sources) if (canPlayAny(probe, s)) return s;
    return (
      sources.find((s) => {
        const u = s.src.toLowerCase();
        return u.endsWith(".mp3") || u.endsWith(".ogg") || u.endsWith(".wav");
      }) ?? sources[0]
    );
  };

  function makeAudio(src: string) {
    const a = new Audio(src);
    a.preload = "auto";
    a.crossOrigin = "anonymous";
    a.loop = false;
    a.volume = 1;
    return a;
  }

  function register(
    id: string,
    sources: Src[],
    opts?: { polyphony?: number; cooldownMs?: number }
  ) {
    const existing = banks.current.get(id);
    if (existing) return existing;

    const pick = pickSupported(sources);
    const polyphony = Math.max(1, Math.min(8, opts?.polyphony ?? 2));
    const pool = Array.from({ length: polyphony }, () => makeAudio(pick.src));
    const bank: Bank = {
      id,
      sources,
      pool,
      polyphony,
      idx: 0,
      lastAt: -1e9,
      cooldownMs: opts?.cooldownMs ?? 60,
    };
    banks.current.set(id, bank);
    return bank;
  }

  const play = useCallback(
    async (id: string, opts: PlayOpts = {}) => {
      ensureDefaults();
      const bank = banks.current.get(id);
      if (!bank || muted) return;

      const now = performance.now();
      if (!opts.allowOverlap && now - bank.lastAt < bank.cooldownMs) return;
      bank.lastAt = now;

      const a = bank.pool[bank.idx];
      bank.idx = (bank.idx + 1) % bank.polyphony;

      try {
        try {
          a.pause();
          a.currentTime = 0;
        } catch {}
        const rateBase = opts.rate ?? 1;
        const det = opts.detuneSemitones ?? 0;
        a.playbackRate = rateBase * Math.pow(2, det / 12);
        a.volume = Math.max(0, Math.min(1, opts.volume ?? 1));
        await a.play();
      } catch {
        const unlock = () => {
          a.play().finally(() => {
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
            window.removeEventListener("touchend", unlock);
          });
        };
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        window.addEventListener("touchend", unlock, { once: true });
      }
    },
    [ensureDefaults, muted]
  );

  return { register, play };
}
