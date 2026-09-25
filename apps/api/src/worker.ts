// ─────────────────────────────────────────────────────────────────────────────
// FreeGameplay content API — Cloudflare Worker entrypoint.
//
//   Workers  →  routing, auth, rate limits, security headers
//   D1       →  content + redirects + migration audit + engagement (SQLite/FTS5)
//   R2       →  media (immutable, content-hashed keys)
//   KV       →  response cache, rate limits, sitemap cache, backups
//   Cron     →  hourly cache sweep + sitemap refresh; daily DB backup to R2
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { cors } from "hono/cors";
import { adminApp, contactApp } from "./admin/admin";
import { kvDeleteByPrefix } from "./lib/cache";
import { apiError } from "./lib/respond";
import { buildSitemap, metaApp } from "./routes/meta";
import { analyticsApp } from "./routes/analytics";
import { commentSubmitApp, commentsApp } from "./routes/comments";
import { contentApp } from "./routes/content";
import { mediaApp } from "./routes/media";
import { redirectApp } from "./routes/redirect";
import { scoresApp } from "./routes/scores";
import { searchApp } from "./routes/search";
import { subscribeApp } from "./routes/subscribe";
import { taxonomyApp } from "./routes/taxonomy";

export interface Bindings {
  DB: D1Database;
  MEDIA: R2Bucket;
  CACHE: KVNamespace;
  ADMIN_TOKEN: string;
  SITE_URL: string;
  APP_VERSION: string;
  /** Salt for the daily visitor hash. Optional in dev, set in production. */
  ANALYTICS_SALT?: string;
  /** Resend (or compatible) API key — enables confirmation/notification email. */
  RESEND_API_KEY?: string;
  /** Envelope sender, e.g. "FreeGameplay <hello@freegameplay.site>". */
  NOTIFY_FROM?: string;
  /** Where contact-form notifications are delivered. */
  NOTIFY_TO?: string;
}

type AppEnv = { Bindings: Bindings };

const app = new Hono<AppEnv>();

// ── Security headers (every response, including errors) ──────────────────────
// The API is a public read-only content service plus a handful of write
// endpoints, so the policy is strict-by-default: nothing is framed, nothing
// is reflected, no plugin content, and the referrer is stripped cross-origin.
app.use("*", async (c, next) => {
  await next();
  const h = c.res.headers;
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("X-Frame-Options", "DENY");
  h.set("Cross-Origin-Resource-Policy", "same-site");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (!h.has("Cache-Control")) h.set("Cache-Control", "no-store");
});

// CORS: the frontend is the only consumer that needs it. Admin endpoints are
// token-gated regardless, so a wide-but-explicit allowlist is safe here.
app.use(
  "*",
  cors({
    origin: ["*"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token", "X-Dry-Run", "X-Import-Meta"],
    exposeHeaders: ["Retry-After"],
    maxAge: 86400,
  }),
);

// ── Public ───────────────────────────────────────────────────────────────────
app.get("/api/health", async (c) => {
  const db = c.env.DB;
  let dbOk = false;
  let counts = { games: 0, posts: 0, guides: 0 };
  try {
    const row = (await db.prepare(`SELECT (SELECT COUNT(*) FROM games) AS games, (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM guides) AS guides`).first()) as
      | { games: number; posts: number; guides: number }
      | null;
    dbOk = true;
    if (row) counts = { games: row.games, posts: row.posts, guides: row.guides };
  } catch {
    dbOk = false;
  }
  return c.json({ ok: dbOk, version: c.env.APP_VERSION, counts }, dbOk ? 200 : 503);
});

app.route("/api", contentApp());
app.route("/api", searchApp());
app.route("/api", redirectApp());
app.route("/api", metaApp());
app.route("/api", contactApp());
app.route("/api", taxonomyApp());
app.route("/api", commentsApp());
app.route("/api", commentSubmitApp());
app.route("/api", scoresApp());
app.route("/api", subscribeApp());
app.route("/api", analyticsApp());
app.route("/api", adminApp());
app.route("/", mediaApp());

// Unknown API routes → JSON 404 (not HTML)
app.get("/api/*", (c) => c.json({ error: "not_found", message: `No API route at ${c.req.path}` }, 404));

app.onError((err, c) => {
  const { status, message } = apiError(err);
  if (status >= 500) console.error(`[api] ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: status >= 500 ? "internal_error" : "error", message: status >= 500 ? "Something went wrong on our side." : message }, status as 500);
});

app.notFound((c) => c.json({ error: "not_found", message: `Unknown route ${c.req.path}` }, 404));

// ── Cron ─────────────────────────────────────────────────────────────────────
// "0 * * * *" → hourly: refresh sitemap, sweep stale cache.
// "0 4 * * *" → daily: dump DB JSON to R2 (keep the 14 most recent) and prune
//               analytics rows older than the reporting window.
async function scheduled(event: ScheduledEvent, env: Bindings): Promise<void> {
  const daily = event.cron === "0 4 * * *";
  if (daily) {
    const tables = ["site_settings", "categories", "tags", "authors", "games", "posts", "guides", "pages", "post_tags", "game_tags", "guide_tags", "redirects", "media", "migration_runs", "messages", "comments", "subscribers", "scores", "pageviews"] as const;
    const dump: Record<string, unknown> = { exportedAt: event.scheduledTime, automatic: true };
    for (const t of tables) {
      dump[t] = (await env.DB.prepare(`SELECT * FROM ${t}`).all()).results;
    }
    const key = `backups/db-${new Date().toISOString().slice(0, 10)}.json`;
    await env.MEDIA.put(key, JSON.stringify(dump), { httpMetadata: { contentType: "application/json" } });
    const objects = await env.MEDIA.list({ prefix: "backups/", limit: 100 });
    const keep = 14;
    if (objects.objects.length > keep) {
      const sorted = [...objects.objects].sort((a, b) => (b.uploaded?.getTime() ?? 0) - (a.uploaded?.getTime() ?? 0));
      await env.MEDIA.delete(sorted.slice(keep).map((o) => o.key));
    }
    // Keep 400 days of pageviews — comfortably beyond any reporting need.
    const cutoff = new Date(Date.now() - 400 * 86400_000).toISOString().slice(0, 10);
    await env.DB.prepare(`DELETE FROM pageviews WHERE day < ?`).bind(cutoff).run();
    console.log(`[cron] daily backup written to ${key}`);
  }
  await kvDeleteByPrefix(env.CACHE, "cache:");
  await kvDeleteByPrefix(env.CACHE, "sitemap");
  await kvDeleteByPrefix(env.CACHE, "board:");
  const xml = await buildSitemap(env.DB, env.SITE_URL);
  await env.CACHE.put("sitemap", JSON.stringify({ xml }), { expirationTtl: 3600 });
  console.log(`[cron] ${event.cron} maintenance complete`);
}

export default {
  fetch: app.fetch,
  scheduled,
};
