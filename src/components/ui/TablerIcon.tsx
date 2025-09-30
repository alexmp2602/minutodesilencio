// app/components/ui/TablerIcon.tsx
"use client";

import type { ComponentType } from "react";
import type { IconProps } from "@tabler/icons-react";
import {
  IconRosette,        // "rosa"
  IconFlower,         // "margarita" genérica
  IconPlant2,         // "tulipán"
  IconChevronLeft,
  IconChevronRight,
  IconTargetArrow,    // "ir a mi flor"
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";

export type IconName =
  | "rose"
  | "tulip"
  | "daisy"
  | "chev-left"
  | "chev-right"
  | "goto"
  | "volume"
  | "volume-off";

const ICONS: Record<IconName, ComponentType<IconProps>> = {
  rose: IconRosette,
  tulip: IconPlant2,
  daisy: IconFlower,
  "chev-left": IconChevronLeft,
  "chev-right": IconChevronRight,
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
  const Cmp = ICONS[name];
  return (
    <Cmp
      size={size}
      stroke={stroke}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      title={title}
      {...rest}
    />
  );
}
