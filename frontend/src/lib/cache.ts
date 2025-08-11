export const cache = new Map<string, { v: any; exp: number }>();

export function getCache<T = any>(key: string): T | undefined {
  const item = cache.get(key);
  if (item && item.exp > Date.now()) return item.v as T;
  if (item) cache.delete(key);
  return undefined;
}

export function setCache<T = any>(key: string, value: T, ttlMs = 60_000): void {
  cache.set(key, { v: value, exp: Date.now() + ttlMs });
}


