// src/lib/fetcher.ts
"use client";

export class FetchError<T = unknown> extends Error {
  status: number;
  url: string;
  data: T | null;
  constructor(
    message: string,
    opts: { status: number; url: string; data: T | null }
  ) {
    super(message);
    this.name = "FetchError";
    this.status = opts.status;
    this.url = opts.url;
    this.data = opts.data;
  }
}

type FetcherInit = RequestInit & {
  /** Timeout en ms (default 15000) */
  timeoutMs?: number;
  /** Reintentos ante timeout / red transitorio / 5xx/429/503 (default 2) */
  retries?: number;
  /** Delay base entre reintentos en ms (default 450) */
  retryDelayMs?: number;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Si estamos en browser y la URL es del mismo origin, devuelve ruta relativa */
function toRelativeIfSameOrigin(input: string): string {
  if (typeof window === "undefined") return input;
  try {
    const u = new URL(input, window.location.href);
    if (u.origin === window.location.origin) {
      return `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    // si no es URL válida, dejamos tal cual
  }
  return input;
}

/** Distingue si parece error de red transitorio */
function isTransientNetworkError(err: unknown): boolean {
  const msg =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message)
      : String(err ?? "");
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: unknown }).code
      : typeof err === "object" && err !== null && "errno" in err
      ? (err as { errno?: unknown }).errno
      : "";
  const name =
    typeof err === "object" && err !== null && "name" in err
      ? (err as { name?: unknown }).name
      : "";

  // Algunos navegadores devuelven TypeError en fallas CORS/red
  return (
    name === "AbortError" ||
    name === "TypeError" ||
    /NetworkError|Failed to fetch|Load failed|ERR_CONNECTION|ECONNRESET|ETIMEDOUT/i.test(
      msg
    ) ||
    code === "ECONNREFUSED"
  );
}

/** Combina señales y timeout; usa AbortSignal.timeout si existe */
function buildSignal(
  initSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; clear: () => void } {
  type AbortSignalWithTimeout = typeof AbortSignal & {
    timeout?: (ms: number) => AbortSignal;
  };

  const abortSignalWithTimeout = AbortSignal as AbortSignalWithTimeout;
  const timeoutSignal: AbortSignal | null =
    typeof abortSignalWithTimeout !== "undefined" &&
    typeof abortSignalWithTimeout.timeout === "function"
      ? abortSignalWithTimeout.timeout!(Math.max(1, timeoutMs | 0))
      : null;

  if (timeoutSignal && !initSignal) {
    return { signal: timeoutSignal, clear: () => {} };
  }

  if (timeoutSignal && initSignal) {
    // AbortSignal.any si existe
    const Any = (
      AbortSignal as unknown as {
        any?: (signals: AbortSignal[]) => AbortSignal;
      }
    ).any;
    if (typeof Any === "function") {
      return { signal: Any([timeoutSignal, initSignal]), clear: () => {} };
    }
    // Fallback manual: encadenamos
    const ctrl = new AbortController();
    const onAbort = () => ctrl.abort();
    timeoutSignal.addEventListener("abort", onAbort, { once: true });
    initSignal.addEventListener("abort", onAbort, { once: true });
    return {
      signal: ctrl.signal,
      clear: () => {
        timeoutSignal.removeEventListener("abort", onAbort);
        initSignal.removeEventListener("abort", onAbort);
      },
    };
  }

  // No AbortSignal.timeout → timer clásico
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1, timeoutMs | 0));

  if (initSignal) {
    const onAbort = () => ctrl.abort();
    initSignal.addEventListener("abort", onAbort, { once: true });
    return {
      signal: ctrl.signal,
      clear: () => {
        clearTimeout(timer);
        initSignal.removeEventListener("abort", onAbort);
      },
    };
  }

  return { signal: ctrl.signal, clear: () => clearTimeout(timer) };
}

function parseRetryAfter(h: string | null): number | null {
  if (!h) return null;
  // Puede venir en segundos o como fecha HTTP
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(h);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

function baseBackoffMs(
  attempt: number,
  retryDelayMs: number,
  retryAfterHeader: string | null
) {
  const headerDelay = parseRetryAfter(retryAfterHeader);
  if (headerDelay != null) return headerDelay;

  // Exponential backoff con jitter
  const expo = retryDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * (retryDelayMs + 120));
  return expo + jitter;
}

export const fetcher = async <T>(
  input: RequestInfo | URL,
  init: FetcherInit = {}
): Promise<T> => {
  const timeoutMs = init.timeoutMs ?? 15000;
  const retries = init.retries ?? 2;
  const retryDelayMs = init.retryDelayMs ?? 450;

  // Normalizamos solo si es string; no clonamos Request (para no romper bodies)
  const normalizedInput: RequestInfo | URL =
    typeof input === "string" ? toRelativeIfSameOrigin(input) : input;

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null;

  const attemptFetch = async (): Promise<{
    res: Response;
    payload: unknown;
  }> => {
    const { signal, clear } = buildSignal(init.signal ?? undefined, timeoutMs);
    try {
      const res = await fetch(normalizedInput, {
        credentials: init.credentials ?? "same-origin",
        ...init,
        headers: {
          Accept: "application/json",
          ...(init?.headers ?? {}),
        },
        signal,
      });

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const method = (init.method || "GET").toUpperCase();
      const noBodyStatus =
        res.status === 204 || res.status === 205 || res.status === 304;
      const noBodyByMethod = method === "HEAD";

      let payload: unknown = null;
      if (!noBodyStatus && !noBodyByMethod) {
        if (ct.includes("application/json")) {
          try {
            payload = await res.json();
          } catch {
            try {
              payload = await res.text();
            } catch {
              payload = null;
            }
          }
        } else {
          // Intentamos JSON (por si el server no setea bien CT) y caemos a texto
          try {
            payload = await res.json();
          } catch {
            try {
              payload = await res.text();
            } catch {
              payload = null;
            }
          }
        }
      }

      return { res, payload };
    } finally {
      clear();
    }
  };

  let attempt = 0;
  // Bucle de reintentos
  while (true) {
    try {
      const { res, payload } = await attemptFetch();

      if (!res.ok) {
        const message =
          (isRecord(payload) &&
            typeof payload.error === "string" &&
            payload.error) ||
          (isRecord(payload) &&
            typeof payload.message === "string" &&
            payload.message) ||
          `HTTP ${res.status}`;

        // Reintentos para 5xx/503/429
        const shouldRetryStatus =
          res.status >= 500 || res.status === 503 || res.status === 429;

        if (shouldRetryStatus && attempt < retries) {
          attempt++;
          const backoff = baseBackoffMs(
            attempt,
            retryDelayMs,
            res.headers.get("retry-after")
          );
          await sleep(backoff);
          continue;
        }

        throw new FetchError(message, {
          status: res.status,
          url: res.url,
          data: (payload as T) ?? null,
        });
      }

      return (payload as T) ?? (null as unknown as T);
    } catch (err: unknown) {
      const transitory = isTransientNetworkError(err);
      if (transitory && attempt < retries) {
        attempt++;
        const backoff =
          retryDelayMs * Math.pow(2, Math.max(0, attempt - 1)) +
          Math.floor(Math.random() * (retryDelayMs + 120));
        await sleep(backoff);
        continue;
      }

      if (err instanceof FetchError) throw err;

      // Error no HTTP (timeout/red) luego de agotar reintentos
      const url =
        typeof normalizedInput === "string"
          ? normalizedInput
          : normalizedInput instanceof Request
          ? normalizedInput.url
          : String(normalizedInput);

      throw new FetchError(
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message?: unknown }).message)
          : "Error de red",
        { status: 0, url, data: null }
      );
    }
  }
};
