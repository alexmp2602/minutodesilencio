// lib/identity.ts
export function getUserId(): string {
  const KEY = "ms:userId";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getUserName(): string | null {
  return localStorage.getItem("ms:userName");
}

export function setUserName(name: string) {
  localStorage.setItem("ms:userName", name);
}
