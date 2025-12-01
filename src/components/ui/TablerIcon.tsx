"use client";

import type { IconProps } from "@tabler/icons-react";
import {
  IconRosette,
  IconFlower,
  IconPlant2,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconTargetArrow,
  IconVolume,
  IconVolumeOff,
} from "@tabler/icons-react";

export type IconName =
  | "rose"
  | "tulip"
  | "daisy"
  | "chev-left"
  | "chev-right"
  | "chev-down"
  | "goto"
  | "volume"
  | "volume-off";

const ICONS: Record<IconName, React.ComponentType<IconProps>> = {
  rose: IconRosette,
  tulip: IconPlant2,
  daisy: IconFlower,
  "chev-left": IconChevronLeft,
  "chev-right": IconChevronRight,
  "chev-down": IconChevronDown,
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

  const labelled =
    !!title ||
    (rest &&
      typeof (rest as Record<string, unknown>)["aria-label"] === "string");

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
