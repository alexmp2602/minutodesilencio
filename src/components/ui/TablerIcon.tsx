"use client";

import type { IconProps } from "@tabler/icons-react";
import {
  IconRosette, // "rosa"
  IconFlower, // "margarita" genérica (fallback)
  IconPlant2, // "tulipán"
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown, // ⬅️ nuevo
  IconTargetArrow, // "ir a mi flor"
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";

export type IconName =
  | "rose"
  | "tulip"
  | "daisy"
  | "chev-left"
  | "chev-right"
  | "chev-down" // ⬅️ nuevo
  | "goto"
  | "volume"
  | "volume-off";

// Nota: NO usamos forwardRef — evitamos el problema de tipos de ref entre versiones.
const ICONS: Record<IconName, React.ComponentType<IconProps>> = {
  rose: IconRosette,
  tulip: IconPlant2,
  daisy: IconFlower,
  "chev-left": IconChevronLeft,
  "chev-right": IconChevronRight,
  "chev-down": IconChevronDown, // ⬅️ nuevo
  goto: IconTargetArrow,
  volume: IconVolume,
  "volume-off": IconVolumeOff,
};

type Props = {
  name: IconName;
  size?: number;
  stroke?: number;
  title?: string;
} & Omit<IconProps, "size" | "stroke">;

export default function TablerIcon({
  name,
  size = 18,
  stroke = 2,
  title,
  ...rest
}: Props) {
  const Cmp = ICONS[name] || IconFlower;

  if (!ICONS[name] && process.env.NODE_ENV !== "production") {
    console.warn(`[TablerIcon] icon name "${name}" not found. Using fallback.`);
  }

  const labelled = !!title || (rest && typeof rest["aria-label"] === "string");

  return (
    <Cmp
      size={size}
      stroke={stroke}
      role={labelled ? "img" : "presentation"}
      aria-hidden={labelled ? undefined : true}
      title={title}
      {...rest}
    />
  );
}
