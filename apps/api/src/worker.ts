// ─────────────────────────────────────────────────────────────────────────────
// FreeGameplay content API — Cloudflare Worker entrypoint.
//
//   Workers  →  routing, auth, rate limits
//   D1       →  content + redirects + migration audit (SQLite/FTS5)
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
import { contentApp } from "./routes/content";
import { mediaApp } from "./routes/media";
import { redirectApp } from "./routes/redirect";
import { searchApp } from "./routes/search";

export interface Bindings {
  DB: D1Database;
  MEDIA: R2Bucket;
  CACHE: KVNamespace;
  ADMIN_TOKEN: string;
  SITE_URL: string;
  APP_VERSION: string;
}

type AppEnv = { Bindings: Bindings };

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: "*", // public read-only content API; admin endpoints require the token
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token", "X-Dry-Run", "X-Import-Meta"],
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
// "0 4 * * *" → daily: dump DB JSON to R2 (keep the 14 most recent).
async function scheduled(event: ScheduledEvent, env: Bindings): Promise<void> {
  const daily = event.cron === "0 4 * * *";
  if (daily) {
    const tables = ["site_settings", "categories", "tags", "authors", "games", "posts", "guides", "pages", "post_tags", "game_tags", "guide_tags", "redirects", "media", "migration_runs"] as const;
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
    console.log(`[cron] daily backup written to ${key}`);
  }
  await kvDeleteByPrefix(env.CACHE, "cache:");
  await kvDeleteByPrefix(env.CACHE, "sitemap");
  const xml = await buildSitemap(env.DB, env.SITE_URL);
  await env.CACHE.put("sitemap", JSON.stringify({ xml }), { expirationTtl: 3600 });
  console.log(`[cron] ${event.cron} maintenance complete`);
}

export default {
  fetch: app.fetch,
  scheduled,
};
