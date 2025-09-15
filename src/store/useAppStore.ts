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
  setStage: (stage) => set({ stage }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
}));
