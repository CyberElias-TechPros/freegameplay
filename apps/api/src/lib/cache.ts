// Non-sensitive public response caches. Versioning isolates old unsafe payloads.
export function cacheKey(path: string): string { return `public:v2:${path}`; }
export async function kvGetJson<T>(kv: KVNamespace, key: string): Promise<T | null> {
  try { const raw = await kv.get(cacheKey(key)); return raw ? JSON.parse(raw) as T : null; }
  catch { return null; }
}
export async function kvSetJson(kv: KVNamespace, key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try { await kv.put(cacheKey(key), JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) }); }
  catch { /* Non-sensitive response caching must not fail the read. */ }
}
export async function kvDeleteByPrefix(kv: KVNamespace, prefix: string): Promise<number> {
  let cursor: string | undefined;
  let removed = 0;
  // Read all page keys before deleting: mutation can shift listing cursors in emulators.
  const keys: string[] = [];
  do {
    const page = await kv.list({ prefix, cursor });
    keys.push(...page.keys.map(k => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  for (let i = 0; i < keys.length; i += 50) {
    await Promise.all(keys.slice(i, i + 50).map(k => kv.delete(k)));
    removed += keys.slice(i, i + 50).length;
  }
  return removed;
}
export async function sweepCaches(kv: KVNamespace): Promise<number> {
  let n = await kvDeleteByPrefix(kv, 'public:');
  n += await kvDeleteByPrefix(kv, 'cache:');
  // Remove legacy bare keys as well; never sweep rate-limit/identity state.
  for (const key of ['home', 'tags', 'authors', 'categories', 'feed', 'sitemap']) await kv.delete(key);
  return n;
}
