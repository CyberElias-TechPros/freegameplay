// XML sitemap + robots.txt. The sitemap is generated from the DB, cached
// in KV for an hour, and refreshed by the hourly cron (and on import).

import { Hono } from "hono";
import { kvGetJson, kvSetJson } from "../lib/cache";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  image?: string | null;
  priority?: string;
}

export async function buildSitemap(db: D1Database, siteUrl: string): Promise<string> {
  const urls: SitemapUrl[] = [];
  const base = siteUrl.replace(/\/+$/, "");

  urls.push({ loc: `${base}/`, priority: "1.0" });
  urls.push({ loc: `${base}/games`, priority: "0.9" });
  urls.push({ loc: `${base}/blog`, priority: "0.8" });
  urls.push({ loc: `${base}/guides`, priority: "0.8" });

  const cats = await db.prepare(`SELECT slug FROM categories ORDER BY sort_order ASC, name ASC`).all<{ slug: string }>();
  for (const r of cats.results) urls.push({ loc: `${base}/categories/${r.slug}`, priority: "0.6" });

  const games = await db
    .prepare(`SELECT slug, COALESCE(updated_at, published_at) AS lastmod, cover_url FROM games ORDER BY published_at DESC NULLS LAST`)
    .all<{ slug: string; lastmod: string | null; cover_url: string | null }>();
  for (const r of games.results) {
    urls.push({ loc: `${base}/games/${r.slug}`, lastmod: r.lastmod ?? undefined, image: r.cover_url, priority: "0.9" });
  }

  const posts = await db
    .prepare(`SELECT slug, COALESCE(updated_at, published_at) AS lastmod, featured_image_url FROM posts ORDER BY published_at DESC NULLS LAST`)
    .all<{ slug: string; lastmod: string | null; featured_image_url: string | null }>();
  for (const r of posts.results) {
    urls.push({ loc: `${base}/blog/${r.slug}`, lastmod: r.lastmod ?? undefined, image: r.featured_image_url, priority: "0.7" });
  }

  const guides = await db
    .prepare(`SELECT slug, COALESCE(updated_at, published_at) AS lastmod, featured_image_url FROM guides ORDER BY published_at DESC NULLS LAST`)
    .all<{ slug: string; lastmod: string | null; featured_image_url: string | null }>();
  for (const r of guides.results) {
    urls.push({ loc: `${base}/guides/${r.slug}`, lastmod: r.lastmod ?? undefined, image: r.featured_image_url, priority: "0.7" });
  }

  const pages = await db.prepare(`SELECT slug, title, content_html, COALESCE(updated_at, published_at) AS lastmod FROM pages ORDER BY slug`).all();
  for (const r of pages.results as { slug: string }[]) {
    urls.push({ loc: `${base}/${r.slug}`, priority: "0.5" });
  }

  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const body = urls
    .map((u) => {
      const imageTag = u.image ? `\n  <image:image>\n    <image:loc>${escape(u.image.startsWith("http") ? u.image : base + u.image)}</image:loc>\n  </image:image>` : "";
      return (
        `  <url>\n    <loc>${escape(u.loc)}</loc>` +
        (u.lastmod ? `\n    <lastmod>${escape(u.lastmod.slice(0, 10))}</lastmod>` : "") +
        (u.priority ? `\n    <priority>${u.priority}</priority>` : "") +
        imageTag +
        `\n  </url>`
      );
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>`;
}

export function metaApp() {
  const app = new Hono<Env>();

  app.get("/sitemap.xml", async (c) => {
    const cached = await kvGetJson<{ xml: string }>(c.env.CACHE, "sitemap");
    if (cached) {
      return c.text(cached.xml, 200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
    }
    const xml = await buildSitemap(c.env.DB, c.env.SITE_URL);
    await kvSetJson(c.env.CACHE, "sitemap", { xml }, 3600);
    return c.text(xml, 200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
  });

  app.get("/robots.txt", async (c) => {
    const base = c.env.SITE_URL.replace(/\/+$/, "");
    return c.text(
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /media/\n\nSitemap: ${base}/sitemap.xml\n`,
      200,
      { "Content-Type": "text/plain; charset=utf-8" },
    );
  });

  return app;
}
