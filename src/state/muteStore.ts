// src/state/muteStore.ts
"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type MuteState = {
  muted: boolean;
  setMuted: (v: boolean) => void;
  toggleMute: () => void;
};

/**
 * Storage seguro:
 * - En entornos donde localStorage no está disponible (Safari Private, iframes estrictos),
 *   cae a un storage en memoria para no reventar la app.
 */
function safeLocalStorage(): Storage {
  try {
    // Acceso perezoso; si falla lanzará y caemos al fallback
    const ls = localStorage;
    // prueba mínima de escritura/lectura
    const probeKey = "__ms_probe__";
    ls.setItem(probeKey, "1");
    ls.removeItem(probeKey);
    return ls;
  } catch {
    // Fallback in-memory (no persistente entre reloads)
    const mem = new Map<string, string | null>();
    return {
      get length() {
        return mem.size;
      },
      clear() {
        mem.clear();
      },
      getItem(key: string) {
        return (mem.get(key) as string | null) ?? null;
      },
      key(index: number) {
        return Array.from(mem.keys())[index] ?? null;
      },
      removeItem(key: string) {
        mem.delete(key);
      },
      setItem(key: string, value: string) {
        mem.set(key, value);
      },
    } as Storage;
  }
}

export const useMuteStore = create<MuteState>()(
  persist(
    (set) => ({
      muted: false,
      setMuted: (v: boolean) => set({ muted: v }),
      toggleMute: () =>
        set((s) => ({
          muted: !s.muted,
        })),
    }),
    {
      // 👇 usamos otra clave para evitar conflicto con los valores antiguos "1"/"0"
      name: "ms:muted:v2",
      version: 2,
      storage: createJSONStorage(() => safeLocalStorage()),
      // Solo persistimos el campo que nos interesa
      partialize: (state) => ({ muted: state.muted }),
      /**
       * Migración:
       * - Si viene estado v1/v2 correcto, lo respeta.
       * - Si no hay nada, intenta leer la clave antigua `ms:muted` ("1"/"0").
       * - Fallback a muted=false.
       */
      migrate: (persistedState) => {
        // Caso 1: ya tenemos un estado persistido válido
        const persisted = persistedState as Partial<MuteState> | undefined;
        if (persisted && typeof persisted.muted === "boolean") {
          return { muted: persisted.muted } as MuteState;
        }

        // Caso 2: migración desde KEY legacy "ms:muted"
        try {
          const legacy = safeLocalStorage().getItem("ms:muted");
          if (legacy === "1" || legacy === "0") {
            return { muted: legacy === "1" } as MuteState;
          }
        } catch {
          // noop: seguimos al fallback
        }

        // Caso 3: fallback
        return { muted: false } as MuteState;
      },
    }
  )
);
