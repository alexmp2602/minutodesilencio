// src/lib/fetcher.ts
export const fetcher = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);

  try {
    const res = await fetch(input, {
      ...init,
      signal: ctrl.signal,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
    });

    const ct = res.headers.get("content-type") ?? "";
    const isJson = ct.includes("application/json");
    const payload: unknown = isJson ? await res.json() : await res.text();

    const isRecord = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null;

    if (!res.ok) {
      const msg =
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return payload as T;
  } finally {
    clearTimeout(timer);
  }
};
