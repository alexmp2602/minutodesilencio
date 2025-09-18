export const STAGES = ["intro", "ritual", "transition", "garden"] as const;
export type Stage = (typeof STAGES)[number];

export const DEFAULT_STAGE: Stage = "intro";

export function isStage(v: unknown): v is Stage {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}
