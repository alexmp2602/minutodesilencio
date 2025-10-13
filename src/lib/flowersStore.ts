// src/lib/flowersStore.ts
export type Flower = {
  id: string;
  message: string | null;
  color: string | null;
  created_at: string;
  x: number;
  y: number;
  z: number;
  family: "rose" | "tulip" | "daisy";
  user_id: string;
  user_name: string | null;
};

// ⚠️ DEV ONLY: estado en memoria (se reinicia con el server)
const store: Flower[] = [];

export function listFlowers(): Flower[] {
  // devolvemos más nuevas primero
  return [...store].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function createFlower(
  input: Omit<Flower, "id" | "created_at"> & { id?: string }
): Flower {
  const id = input.id ?? crypto.randomUUID();
  const created_at = new Date().toISOString();
  const f: Flower = { id, created_at, ...input };
  store.unshift(f);
  return f;
}

export function getFlower(id: string): Flower | null {
  return store.find((f) => f.id === id) ?? null;
}

export function updateFlowerMessage(
  id: string,
  message: string | null
): Flower | null {
  const f = store.find((x) => x.id === id);
  if (!f) return null;
  f.message = message;
  return f;
}
