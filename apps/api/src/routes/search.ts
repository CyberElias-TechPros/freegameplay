// Site-wide search: FTS5 primary, LIKE fallback (malformed queries,
// very short queries, or future table churn must never 500).

import { Hono } from "hono";
import type { SearchHit, SearchType } from "@fg/shared";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

function ftsQuery(raw: string): string | null {
  const tokens = raw
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"`).join(" ");
}

interface FtsRow {
  rowid: number;
  rank: number;
}

async function ftsMatch(db: D1Database, table: string, query: string, limit: number): Promise<FtsRow[]> {
  const res = await db.prepare(`SELECT rowid, rank FROM ${table}_fts WHERE ${table}_fts MATCH ? ORDER BY rank ASC LIMIT ?`).bind(query, limit).all<FtsRow>();
  return res.results;
}

async function likeSearch(
  db: D1Database,
  type: SearchType,
  raw: string,
  limit: number,
): Promise<SearchHit[]> {
  const like = `%${raw.replace(/[%_]/g, "")}%`;
  const map: Record<SearchType, { sql: string; url: string }> = {
    games: { sql: `SELECT id, slug, title, tagline AS excerpt, cover_url, published_at FROM games WHERE title LIKE ? OR tagline LIKE ? OR description LIKE ? ORDER BY published_at DESC NULLS LAST LIMIT ?`, url: "/games/" },
    posts: { sql: `SELECT id, slug, title, excerpt, featured_image_url AS cover_url, published_at FROM posts WHERE title LIKE ? OR excerpt LIKE ? OR content_html LIKE ? ORDER BY published_at DESC NULLS LAST LIMIT ?`, url: "/blog/" },
    guides: { sql: `SELECT id, slug, title, excerpt, featured_image_url AS cover_url, published_at FROM guides WHERE title LIKE ? OR excerpt LIKE ? OR content_html LIKE ? ORDER BY published_at DESC NULLS LAST LIMIT ?`, url: "/guides/" },
  };
  const spec = map[type];
  const res = await db
    .prepare(spec.sql)
    .bind(like, like, like, limit)
    .all<{ id: number; slug: string; title: string; excerpt: string | null; cover_url: string | null; published_at: string | null }>();
  return res.results.map((r, i) => ({
    type,
    id: r.id,
    slug: r.slug,
    title: r.title,
    excerpt: r.excerpt,
    coverUrl: r.cover_url,
    url: spec.url + r.slug,
    score: (res.results.length - i) / res.results.length,
    publishedAt: r.published_at,
  }));
}

function hitFromRow(type: SearchType, row: { id: number; slug: string; title: string; excerpt: string | null; cover_url: string | null; published_at: string | null }, score: number): SearchHit {
  const url = type === "games" ? "/games/" : type === "posts" ? "/blog/" : "/guides/";
  return { type, id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt, coverUrl: row.cover_url, url: url + row.slug, score, publishedAt: row.published_at };
}

export function searchApp() {
  const app = new Hono<Env>();

  app.get("/search", async (c) => {
    const started = Date.now();
    const q = (c.req.query("q") ?? "").trim();
    if (q.length < 2) {
      return c.json({ q, hits: [], tookMs: Date.now() - started });
    }
    const db = c.env.DB;
    const typesRaw = c.req.query("type");
    const types: SearchType[] = typesRaw
      ? (typesRaw.split(",").filter((t): t is SearchType => t === "games" || t === "posts" || t === "guides"))
      : ["games", "posts", "guides"];
    const perType = Math.min(8, Math.max(1, Number(c.req.query("limit") ?? 8) || 8));

    const query = ftsQuery(q);
    const hits: SearchHit[] = [];

    for (const type of types) {
      let rows: FtsRow[] = [];
      if (query) {
        try {
          rows = await ftsMatch(db, type, query, perType);
        } catch {
          rows = [];
        }
      }
      if (rows.length > 0) {
        const ids = rows.map((r) => r.rowid);
        const lookupSql =
          type === "games"
            ? `SELECT id, slug, title, tagline AS excerpt, cover_url, published_at FROM games WHERE id IN (${ids.map(() => "?").join(",")})`
            : type === "posts"
              ? `SELECT id, slug, title, excerpt, featured_image_url AS cover_url, published_at FROM posts WHERE id IN (${ids.map(() => "?").join(",")})`
              : `SELECT id, slug, title, excerpt, featured_image_url AS cover_url, published_at FROM guides WHERE id IN (${ids.map(() => "?").join(",")})`;
        const res = await db.prepare(lookupSql).bind(...ids).all();
        const byId = new Map<number, (typeof res.results)[number]>(res.results.map((r) => [r.id as number, r]));
        const bestRank = rows.length;
        rows.forEach((r, i) => {
          const row = byId.get(r.rowid);
          if (row) hits.push(hitFromRow(type, row as never, (bestRank - i) / bestRank));
        });
      } else {
        hits.push(...(await likeSearch(db, type, q, perType)));
      }
    }

    hits.sort((a, b) => b.score - a.score);
    return c.json({ q, hits: hits.slice(0, 24), tookMs: Date.now() - started });
  });

  return app;
}
