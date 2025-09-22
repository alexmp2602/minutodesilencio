// src/store/useAppStore.ts
import { create } from "zustand";
import type { Stage } from "@/lib/stages";

type AppState = {
  stage: Stage;
  muted: boolean;
  setStage: (s: Stage) => void;
  toggleMute: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  stage: "intro",
  muted: false,
  setStage: (next) => set((s) => (s.stage === next ? s : { stage: next })), // evita re-renders en bucle
  toggleMute: () => set((s) => ({ muted: !s.muted })),
}));
