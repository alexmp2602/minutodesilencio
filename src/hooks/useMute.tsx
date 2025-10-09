// src/hooks/useMute.tsx
"use client";

import * as React from "react";
// ⬇️ Fallback a tu store global de Zustand
import { useMuteStore } from "@/state/muteStore";

type Ctx = {
  muted: boolean;
  toggleMute: () => void;
  setMuted: (v: boolean) => void;
};

// Contexto opcional (si lo usás)
export const MuteContext = React.createContext<Ctx | null>(null);

const KEY = "ms:muted";

// Helpers de persistencia
function readPersistedMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
function writePersistedMuted(v: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
}

/**
 * Provider opcional: si lo usás, prioriza este contexto.
 * Si NO lo usás, useMute hará fallback automático a Zustand.
 */
export function MuteProvider({ children }: { children: React.ReactNode }) {
  const [muted, setMuted] = React.useState<boolean>(() => readPersistedMuted());

  React.useEffect(() => {
    writePersistedMuted(muted);
    try {
      document?.body?.setAttribute("data-muted", String(muted));
    } catch {}
  }, [muted]);

  // Sync entre pestañas
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.storageArea === localStorage) {
        // e.newValue puede ser null si se elimina la key
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

/**
 * Hook unificado:
 * - Si hay Provider, usa el contexto (y retorna temprano).
 * - Si NO hay Provider, usa Zustand (fallback) y NO tira error.
 */
export function useMute(): Ctx {
  const ctx = React.useContext(MuteContext);

  // ⬇️ Fallback a Zustand (sin Provider)
  const muted = useMuteStore((s) => s.muted);
  const toggleMute = useMuteStore((s) => s.toggleMute);
  const setMuted = useMuteStore(
    (s) =>
      s.setMuted ??
      ((v: boolean) => {
        // Si tu store no tiene setMuted, lo derivamos del toggle
        const current = useMuteStore.getState().muted;
        if (v !== current) useMuteStore.getState().toggleMute();
      })
  );

  // Persistencia mínima también desde el fallback
  React.useEffect(() => {
    if (!ctx) {
      writePersistedMuted(muted);
      try {
        document?.body?.setAttribute("data-muted", String(muted));
      } catch {}
    }
  }, [muted, ctx]);

  if (ctx) {
    // ✅ Si hay Provider, evitamos suscribirnos a Zustand innecesariamente
    return ctx;
  }

  return { muted, toggleMute, setMuted };
}
