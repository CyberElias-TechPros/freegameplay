// Minimal fixed-window rate limiter on KV. Good enough for public
// write endpoints (contact form) without bringing in a full security stack.

import type { Context } from "hono";

interface Bucket {
  count: number;
  resetAt: number;
}

export async function rateLimit(
  c: Context,
  kv: KVNamespace,
  name: string,
  limit: number,
  windowSeconds: number,
): Promise<Response | null> {
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const key = `rl:${name}:${ip}`;
  const now = Date.now();

  let bucket: Bucket = { count: 0, resetAt: now + windowSeconds * 1000 };
  const raw = await kv.get(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Bucket;
      if (parsed.resetAt > now) bucket = parsed;
    } catch {
      /* corrupt bucket → reset */
    }
  }

  bucket.count += 1;
  await kv.put(key, JSON.stringify(bucket), { expirationTtl: windowSeconds + 10 });

  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return c.json(
      { error: "rate_limited", message: "Too many requests. Try again shortly." },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }
  return null;
}
