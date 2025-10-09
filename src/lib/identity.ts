// lib/identity.ts

/** Claves únicas para LocalStorage */
const KEY_ID = "ms:userId";
const KEY_NAME = "ms:userName";

/** ¿Estamos en el browser? (evita crashear en SSR/Edge) */
const isBrowser = () => typeof window !== "undefined";

/** Accesos a localStorage con try/catch (Safari Private, quotas, etc.) */
const safeStorage = {
  get(key: string): string | null {
    try {
      if (!isBrowser()) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      if (!isBrowser()) return;
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key: string) {
    try {
      if (!isBrowser()) return;
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/** UUID v4 robusto:
 *  - usa crypto.randomUUID si existe
 *  - sino, compone un v4 con crypto.getRandomValues
 *  - último fallback: Math.random
 */
function makeId(): string {
  if (isBrowser() && typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (isBrowser() && typeof crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Ajustes RFC 4122 v4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const hex = Array.from(bytes, toHex).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
      12,
      16
    )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Fallback: pseudo-UUID (suficiente para identidad local)
  const rnd = (n = 16) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-a${rnd(3)}-${rnd(12)}`;
}

/** Cache en memoria para no tocar storage en cada llamada */
let cachedId: string | null = null;
let cachedName: string | null | undefined = undefined;

/** Listener de sincronización entre pestañas (una sola vez) */
let storageListenerAttached = false;
function attachStorageSync() {
  if (!isBrowser() || storageListenerAttached) return;
  const onStorage = (e: StorageEvent) => {
    if (!e || e.storageArea !== window.localStorage) return;
    if (e.key === KEY_NAME) {
      // e.newValue puede ser null (borrado)
      cachedName =
        typeof e.newValue === "string" && e.newValue.trim() ? e.newValue : null;
    } else if (e.key === KEY_ID) {
      // Si cambian el id (raro), sincronizamos la cache
      cachedId =
        typeof e.newValue === "string" && e.newValue ? e.newValue : null;
    }
  };
  window.addEventListener("storage", onStorage);
  storageListenerAttached = true;
}

/** Devuelve/crea un id estable de usuario (o "anon" en SSR) */
export function getUserId(): string {
  if (!isBrowser()) return "anon";
  attachStorageSync();
  if (cachedId) return cachedId;

  let id = safeStorage.get(KEY_ID);
  if (!id) {
    id = makeId();
    safeStorage.set(KEY_ID, id);
  }
  cachedId = id;
  return id;
}

/** Nombre opcional guardado (null si no hay o en SSR) */
export function getUserName(): string | null {
  if (!isBrowser()) return null;
  attachStorageSync();
  if (cachedName !== undefined) return cachedName ?? null;

  const raw = safeStorage.get(KEY_NAME);
  cachedName = raw && raw.trim() ? raw : null;
  return cachedName;
}

/** Normaliza nombres: trim, colapsa espacios, corta a 40 chars. */
function normalizeName(input: string): string {
  // Reemplaza espacios múltiples/line breaks por un solo espacio
  const cleaned = input.replace(/\s+/g, " ").trim();
  // Límite razonable para chips/labels breves
  const limit = 40;
  return cleaned.length > limit ? cleaned.slice(0, limit) : cleaned;
}

/**
 * Setea el nombre del usuario.
 * - Si `name` es vacío/null -> borra el nombre.
 * - Devuelve el valor final guardado (o null si se eliminó).
 */
export function setUserName(name: string | null): string | null {
  if (!isBrowser()) return null;
  attachStorageSync();

  const final = name ? normalizeName(name) : "";
  if (!final) {
    safeStorage.remove(KEY_NAME);
    cachedName = null;
    return null;
  }

  safeStorage.set(KEY_NAME, final);
  cachedName = final;
  return final;
}
