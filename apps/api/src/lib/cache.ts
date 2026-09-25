// KV-backed response cache. Keys are versioned so a cron sweep is a no-op
// and explicit invalidation is a single deleteMany.

const PREFIX = "cache:";
const SWEPT_PREFIXES = ["cache:"];

export function cacheKey(path: string): string {
  return PREFIX + path.replace(/[^a-zA-Z0-9/_?=&-]/g, "-");
}

export async function kvGetJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(kv: KVNamespace, key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    // Cloudflare KV requires TTLs of 60s or more — clamp rather than fail.
    await kv.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
  } catch {
    /* cache write failure is non-fatal */
  }
}

export async function kvDeleteByPrefix(kv: KVNamespace, prefix: string): Promise<number> {
  const list = await kv.list({ prefix });
  const keys = list.keys.map((k) => k.name);
  if (keys.length > 0) await Promise.all(keys.map((k) => kv.delete(k)));
  return keys.length;
}

export async function sweepCaches(kv: KVNamespace): Promise<number> {
  let removed = 0;
  for (const prefix of SWEPT_PREFIXES) removed += await kvDeleteByPrefix(kv, prefix);
  return removed;
}
