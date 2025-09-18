export const FLOWER_STATES = ["alive", "decayed", "wilted", "revived"] as const;
export type FlowerState = (typeof FLOWER_STATES)[number];

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

  wilted?: boolean | null;
  revived_at?: ISODateString | null;
  state?: FlowerState | null;
  family?: string | null;
};
