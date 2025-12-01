// src/hooks/useMute.tsx
"use client";

import * as React from "react";
import { useMuteStore } from "@/state/muteStore";

type Ctx = {
  muted: boolean;
  toggleMute: () => void;
  setMuted: (v: boolean) => void;
};

export const MuteContext = React.createContext<Ctx | null>(null);

const KEY = "ms:muted";

// Lectura simple de localStorage
function readPersistedMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

// Escritura simple de localStorage
function writePersistedMuted(v: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
}

// Provider opcional: si se usa, el hook lo toma como prioridad
export function MuteProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMuted] = React.useState(() => readPersistedMuted());

  React.useEffect(() => {
    writePersistedMuted(muted);
    try {
      document?.body?.setAttribute("data-muted", String(muted));
    } catch {}
  }, [muted]);

  // Sync de estado entre pestañas
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.storageArea === localStorage) {
        setMuted(e.newValue === "1");
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleMute = React.useCallback(() => setMuted((m) => !m), []);

  const value = React.useMemo(
    () => ({ muted, toggleMute, setMuted }),
    [muted, toggleMute]
  );

  return <MuteContext.Provider value={value}>{children}</MuteContext.Provider>;
}

// Hook unificado: usa contexto si existe, o Zustand como fallback
export function useMute(): Ctx {
  const ctx = React.useContext(MuteContext);

  // Fallback a Zustand
  const muted = useMuteStore((s) => s.muted);
  const toggleMute = useMuteStore((s) => s.toggleMute);

  const setMuted = useMuteStore(
    (s) =>
      s.setMuted ??
      ((v: boolean) => {
        const current = useMuteStore.getState().muted;
        if (v !== current) useMuteStore.getState().toggleMute();
      })
  );

  // Persistencia cuando no hay Provider
  React.useEffect(() => {
    if (!ctx) {
      writePersistedMuted(muted);
      try {
        document?.body?.setAttribute("data-muted", String(muted));
      } catch {}
    }
  }, [muted, ctx]);

  if (ctx) return ctx;

  return { muted, toggleMute, setMuted };
}
