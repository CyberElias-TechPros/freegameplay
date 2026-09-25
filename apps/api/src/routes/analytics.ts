// First-party analytics.
//
//   POST /api/analytics/pageview   → public beacon (no cookies, no PII)
//
// The whole point of this being first-party is that nothing identifying is
// stored: no IP, no user-agent, no cookie, no fingerprint. A visitor is a
// daily-rotating hash (see lib/identity.ts), the referrer is reduced to its
// host, and the device is a coarse viewport bucket. That is enough to answer
// "what is people reading, and where did they come from" — which is the only
// question a site this size actually needs answered.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { dayBucket, deviceBucket, referrerHost, requestCountry, visitorHash } from "../lib/identity";
import { rateLimit } from "../lib/rate";
import { badRequest } from "../lib/respond";
import { safePath } from "../lib/validate";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

/** Endpoints we don't want polluting the numbers. */
const IGNORED_PREFIXES = ["/api/", "/media/", "/_next/", "/admin"];

export function analyticsApp() {
  const app = new Hono<Env>();

  app.post("/analytics/pageview", async (c) => {
    // Beacons are cheap; still cap them so a buggy client can't write hot loops.
    const limited = await rateLimit(c, c.env.CACHE, "beacon", 120, 3600);
    if (limited) return limited;

    const body = (await c.req.json().catch(() => null)) as { path?: unknown; referrer?: unknown; vw?: unknown } | null;
    const path = safePath(body?.path);
    if (IGNORED_PREFIXES.some((p) => path.startsWith(p))) {
      return c.json({ ok: true, ignored: true }, 202);
    }

    const vw = typeof body?.vw === "number" && Number.isFinite(body.vw) ? body.vw : undefined;
    const host = referrerHost(typeof body?.referrer === "string" ? body.referrer : undefined, new URL(c.env.SITE_URL || "http://localhost").hostname);
    const hash = await visitorHash(c, c.env.ANALYTICS_SALT);

    try {
      await c.env.DB.prepare(
        `INSERT INTO pageviews (day, path, referrer_host, device_bucket, visitor_hash) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(dayBucket(), path.slice(0, 300), host, deviceBucket(vw), hash)
        .run();
    } catch {
      // Analytics must never break the page that called it.
      return c.json({ ok: false }, 202);
    }
    return c.json({ ok: true }, 202);
  });

  return app;
}

/** Aggregate a report over the last N days. Shared by the admin endpoint. */
export async function buildAnalyticsReport(db: Bindings["DB"], days = 30): Promise<import("@fg/shared").AnalyticsReport> {
  const span = Math.min(365, Math.max(1, Math.floor(days)));
  const since = new Date(Date.now() - span * 86400_000).toISOString().slice(0, 10);

  const series = (
    await db
      .prepare(
        `SELECT day, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
           FROM pageviews WHERE day >= ? GROUP BY day ORDER BY day ASC`,
      )
      .bind(since)
      .all<{ day: string; views: number; visitors: number }>()
  ).results;

  const topPages = (
    await db
      .prepare(
        `SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors
           FROM pageviews WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 25`,
      )
      .bind(since)
      .all<{ path: string; views: number; visitors: number }>()
  ).results;

  const topReferrers = (
    await db
      .prepare(
        `SELECT COALESCE(referrer_host, '(direct)') AS referrer, COUNT(*) AS views
           FROM pageviews WHERE day >= ? GROUP BY referrer ORDER BY views DESC LIMIT 15`,
      )
      .bind(since)
      .all<{ referrer: string; views: number }>()
  ).results;

  const devices = (
    await db
      .prepare(`SELECT device_bucket AS bucket, COUNT(*) AS views FROM pageviews WHERE day >= ? GROUP BY device_bucket ORDER BY views DESC`)
      .bind(since)
      .all<{ bucket: string; views: number }>()
  ).results;

  const totals = (
    await db
      .prepare(`SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_hash) AS visitors, COUNT(DISTINCT path) AS pages FROM pageviews WHERE day >= ?`)
      .bind(since)
      .first<{ views: number; visitors: number; pages: number }>()
  ) ?? { views: 0, visitors: 0, pages: 0 };

  void requestCountry;

  return {
    days: span,
    totals: { views: totals.views ?? 0, visitors: totals.visitors ?? 0, pages: totals.pages ?? 0 },
    series: series.map((r) => ({ day: r.day, views: Number(r.views), visitors: Number(r.visitors) })),
    topPages: topPages.map((r) => ({ path: r.path, views: Number(r.views), visitors: Number(r.visitors) })),
    topReferrers: topReferrers.map((r) => ({ referrer: r.referrer, views: Number(r.views) })),
    devices: devices.map((r) => ({ bucket: r.bucket, views: Number(r.views) })),
  };
}
