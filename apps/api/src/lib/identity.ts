// Client identity helpers.
//
// Every write endpoint that can be abused (scores, comments, subscriptions,
// analytics beacons) needs *some* stable identity to rate-limit and moderate
// against. Storing raw IPs would make this a personal-data store, so we keep
// only a keyed, daily-rotating hash:
//
//   sha256( day | clientIp | ANALYTICS_SALT )
//
// • repeat visits in one day collapse to one visitor id (that is the point)
// • nothing is joinable across days
// • no raw IP, user-agent or fingerprint is ever persisted
//
// ANALYTICS_SALT is a Worker secret. When unset we fall back to a per-isolate
// constant so the app still runs locally — the hash is just less meaningful.

const FALLBACK_SALT = "freegameplay-local-dev-salt";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** UTC day bucket, e.g. "2026-09-25". */
export function dayBucket(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Best-effort client IP from Cloudflare's edge headers. */
export function clientIp(c: { req: { header: (n: string) => string | undefined; raw: unknown } }): string {
  const cf = (c.req.raw as { cf?: { connectingIp?: string } }).cf;
  return (
    cf?.connectingIp ??
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "0.0.0.0"
  );
}

/** Stable-per-day visitor hash. Never store the input. */
export async function visitorHash(c: Parameters<typeof clientIp>[0], salt?: string): Promise<string> {
  const ip = clientIp(c);
  return sha256Hex(`${dayBucket()}|${ip}|${salt ?? FALLBACK_SALT}`);
}

/** Country from Cloudflare edge metadata ("local" in dev). */
export function requestCountry(c: { req: { raw: unknown } }): string {
  const cf = (c.req.raw as { cf?: { country?: string } }).cf;
  return (cf?.country ?? "local").toUpperCase().slice(0, 2);
}

/** Coarse device bucket from the viewport width the client volunteers. */
export function deviceBucket(vw: number | undefined): string {
  if (!vw || !Number.isFinite(vw)) return "unknown";
  if (vw < 640) return "mobile";
  if (vw < 1024) return "tablet";
  return "desktop";
}

/** Host-only referrer (we never keep full referring URLs with query strings). */
export function referrerHost(referrer: string | undefined, siteHost: string): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer, "https://_");
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host === "_" || host === siteHost) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}
