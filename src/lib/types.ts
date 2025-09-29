// src/lib/types.ts
export const FLOWER_STATES = ["alive", "decayed", "wilted", "revived"] as const;
export type FlowerState = (typeof FLOWER_STATES)[number];

export const FLOWER_FAMILIES = ["rose", "tulip", "daisy"] as const;
export type FlowerFamily = (typeof FLOWER_FAMILIES)[number];

export type ISODateString = string;
export type FlowerId = string;

export type Flower = {
  id: FlowerId;
  message: string | null;

  color?: string | null;

  x?: number | null;
  y?: number | null;
  z?: number | null;

  created_at?: ISODateString;
  updated_at?: ISODateString | null;
  user_id?: string | null;

  alive?: boolean;
  wilted?: boolean | null;
  revived_at?: ISODateString | null;
  state?: FlowerState | null;

  // usamos 'family' como la variante (rose/tulip/daisy)
  family?: FlowerFamily | null;

  // opcional: si más adelante guardás 'variant', lo aceptamos igual
  variant?: FlowerFamily | null;
};
