// src/lib/types.ts

/* ===========================
   Tokens y tipos base
   =========================== */
export const FLOWER_STATES = ["alive", "decayed", "wilted", "revived"] as const;
export type FlowerState = (typeof FLOWER_STATES)[number];

export const FLOWER_FAMILIES = ["rose", "tulip", "daisy"] as const;
export type FlowerFamily = (typeof FLOWER_FAMILIES)[number];

export type ISODateString = string;
export type FlowerId = string;

/* ===========================
   Modelo principal
   =========================== */
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

  alive?: boolean; // preferido
  wilted?: boolean | null; // legado
  revived_at?: ISODateString | null;
  state?: FlowerState | null;

  // usamos 'family' como la variante (rose/tulip/daisy)
  family?: FlowerFamily | null;

  // alias opcional para compat
  variant?: FlowerFamily | null;

  // opcional: nombre de usuario
  user_name?: string | null;
};

/* ===========================
   Type Guards y helpers
   =========================== */
export function isFlowerFamily(v: unknown): v is FlowerFamily {
  return (
    typeof v === "string" && (FLOWER_FAMILIES as readonly string[]).includes(v)
  );
}

export function isFlowerState(v: unknown): v is FlowerState {
  return (
    typeof v === "string" && (FLOWER_STATES as readonly string[]).includes(v)
  );
}

export function isIsoDateString(v: unknown): v is ISODateString {
  // Validación liviana pero evita números/objetos
  return typeof v === "string" && v.length >= 10 && /\d{4}-\d{2}-\d{2}/.test(v);
}

export function isFlower(v: unknown): v is Flower {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== "string") return false;
  // message debe existir y ser string|null
  if (!("message" in r)) return false;
  const m = (r as { message: unknown }).message;
  if (!(typeof m === "string" || m === null)) return false;
  return true;
}

/* ===========================
   Normalizador
   - Mantiene compat con tus APIs
   - Sanea inputs dudosos (strings numéricos, variant/family, msg len)
   =========================== */

type MaybeNum = number | string | null | undefined;

function toNumOrNull(v: MaybeNum): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, 140);
}

/**
 * Recorta message y normaliza family/variant/flags/coords.
 * No elimina campos extra; sólo corrige lo esperado.
 */
export function normalizeFlower<T extends Partial<Flower>>(f: T): Flower {
  const id = String((f as Record<string, unknown>).id ?? "");
  const message = normalizeMessage((f as Record<string, unknown>).message);

  // Coords
  const x = toNumOrNull(f.x);
  const y = toNumOrNull(f.y);
  const z = toNumOrNull(f.z);

  // Family / variant (alias -> family)
  const rawFamily = f.family ?? f.variant ?? null;
  const family = isFlowerFamily(rawFamily) ? rawFamily : null;

  // Estado/flags
  const state = isFlowerState(f.state) ? f.state : null;

  const wilted =
    f.wilted == null
      ? null
      : typeof f.wilted === "boolean"
      ? f.wilted
      : !!f.wilted;

  let alive: boolean | undefined =
    typeof f.alive === "boolean" ? f.alive : undefined;
  if (alive === undefined) alive = wilted === true ? false : true;

  const created_at = isIsoDateString(f.created_at) ? f.created_at : undefined;
  const updated_at =
    f.updated_at == null
      ? null
      : isIsoDateString(f.updated_at)
      ? f.updated_at
      : null;

  const revived_at =
    f.revived_at == null
      ? null
      : isIsoDateString(f.revived_at)
      ? f.revived_at
      : null;

  const color =
    typeof f.color === "string" && f.color.trim() ? f.color.trim() : null;

  const user_id =
    typeof f.user_id === "string" && f.user_id.trim() ? f.user_id : null;

  const user_name =
    typeof f.user_name === "string" && f.user_name.trim() ? f.user_name : null;

  // Construimos explícito para no arrastrar tipos incorrectos
  const out: Flower = {
    id,
    message,
    x,
    y,
    z,
    color,
    family,
    variant: family ?? null,
    created_at,
    updated_at,
    revived_at,
    user_id,
    user_name,
    state,
    alive,
    wilted,
  };

  return out;
}

/* ===========================
   Tipos y helpers de API
   =========================== */

// Lo que solemos enviar al API al crear una flor
export type CreateFlowerInput = {
  message?: string; // opcional, se recorta a 140
  x?: number;
  y?: number;
  z?: number;
  color?: string;
  family?: FlowerFamily; // preferido
  variant?: FlowerFamily; // alias
  user_id?: string;
  user_name?: string | null;
};

/** Sanea un payload antes de POST (opcional de usar) */
export function normalizeCreateFlowerInput(
  input: CreateFlowerInput
): CreateFlowerInput {
  const msg = normalizeMessage(input.message ?? null) ?? undefined;
  const family = isFlowerFamily(input.family ?? input.variant ?? null)
    ? (input.family ?? input.variant)!
    : undefined;

  return {
    message: msg,
    x: toNumOrNull(input.x) ?? undefined,
    y: toNumOrNull(input.y) ?? undefined,
    z: toNumOrNull(input.z) ?? undefined,
    color:
      typeof input.color === "string" && input.color.trim()
        ? input.color.trim()
        : undefined,
    family,
    variant: family, // mantener alias por compat
    user_id:
      typeof input.user_id === "string" && input.user_id.trim()
        ? input.user_id
        : undefined,
    user_name:
      typeof input.user_name === "string" && input.user_name.trim()
        ? input.user_name
        : null,
  };
}

// Respuesta típica de endpoints
export type FlowersResponse = {
  flowers: Flower[];
  ok?: boolean;
};

export type FlowerResponse = {
  flower: Flower;
  ok?: boolean;
};

/* ===========================
   Mensajes (solapa superior)
   =========================== */
export type Message = {
  id: string;
  text: string;
  created_at?: string | null;
  user_id?: string | null;
  user_name?: string | null;
};
