export type FlowerState = "alive" | "decayed" | "wilted" | "revived";

export type Flower = {
  id: string;
  message?: string | null;

  color?: string | null;
  x?: number | null;
  y?: number | null;
  z?: number | null;

  created_at?: string;
  updated_at?: string | null;
  user_id?: string | null;

  wilted?: boolean | null;
  revived_at?: string | null;
  state?: FlowerState | null;
  family?: string | null;
};
