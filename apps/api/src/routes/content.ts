// Public content routes — the contract the frontend consumes.
// Every list endpoint is KV-cached (60s) so the Worker stays cheap at scale.

import { Hono } from "hono";
import { kvGetJson, kvSetJson } from "../lib/cache";
import { all, one } from "../lib/db";
import {
  categoryNames,
  gameRowToGame,
  guideRowToGuide,
  postRowToPost,
  tagRowsToTags,
  tagsForGames,
  tagsForGuides,
  tagsForPosts,
  toCategories,
  type GameRow,
  type GuideRow,
  type PostRow,
  type TagRow,
} from "../serialize";
import type { Tag } from "@fg/shared";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

const GAMES_LIST_SQL = `
  SELECT g.*, c.name AS category_name
  FROM games g LEFT JOIN categories c ON c.id = g.category_id
`;
const POSTS_LIST_SQL = `
  SELECT p.*, a.name AS author_name, a.slug AS author_slug, c.name AS category_name
  FROM posts p
  LEFT JOIN authors a ON a.id = p.author_id
  LEFT JOIN categories c ON c.id = p.category_id
`;
const GUIDES_LIST_SQL = `
  SELECT gu.*, a.name AS author_name, a.slug AS author_slug, c.name AS category_name,
         g.title AS game_title, g.slug AS game_slug
  FROM guides gu
  LEFT JOIN authors a ON a.id = gu.author_id
  LEFT JOIN categories c ON c.id = gu.category_id
  LEFT JOIN games g ON g.id = gu.game_id
`;

function parsePageParam(raw: string | undefined, fallback: number): number {
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}
function parsePageSize(raw: string | undefined): number {
  const n = raw ? Number(raw) : 12;
  return Number.isFinite(n) ? Math.min(48, Math.max(1, Math.floor(n))) : 12;
}

export function contentApp() {
  const app = new Hono<Env>();

  // ── Aggregate home payload ─────────────────────────────────────────────────
  app.get("/content/home", async (c) => {
    const cached = await kvGetJson(c.env.CACHE, "home");
    if (cached) return c.json(cached);

    const db = c.env.DB;
    const site = await one<{ id: number; name: string; tagline: string | null; description: string | null }>(
      db.prepare(`SELECT id, name, tagline, description FROM site_settings WHERE id = 1`),
    );
    const counts = {
      games: (await one<{ n: number }>(db.prepare(`SELECT COUNT(*) AS n FROM games`)))?.n ?? 0,
      posts: (await one<{ n: number }>(db.prepare(`SELECT COUNT(*) AS n FROM posts`)))?.n ?? 0,
      guides: (await one<{ n: number }>(db.prepare(`SELECT COUNT(*) AS n FROM guides`)))?.n ?? 0,
      categories: (await one<{ n: number }>(db.prepare(`SELECT COUNT(*) AS n FROM categories`)))?.n ?? 0,
      playableNow: (await one<{ n: number }>(db.prepare(`SELECT COUNT(*) AS n FROM games WHERE playable_type != 'none'`)))?.n ?? 0,
    };

    const featuredRows = await all<GameRow & { category_name: string | null }>(
      db.prepare(`${GAMES_LIST_SQL} WHERE g.featured = 1 ORDER BY g.trending DESC, g.published_at DESC LIMIT 4`),
    );
    const latestGameRows = await all<GameRow & { category_name: string | null }>(
      db.prepare(`${GAMES_LIST_SQL} ORDER BY g.published_at DESC NULLS LAST LIMIT 6`),
    );
    const latestPostRows = await all<PostRow>(
      db.prepare(`${POSTS_LIST_SQL} WHERE p.published_at IS NOT NULL ORDER BY p.published_at DESC LIMIT 6`),
    );
    const latestGuideRows = await all<GuideRow>(
      db.prepare(`${GUIDES_LIST_SQL} WHERE gu.published_at IS NOT NULL ORDER BY gu.published_at DESC LIMIT 4`),
    );
    const categoryRows = await all<{ id: number; slug: string; name: string; description: string | null; sort_order: number }>(
      db.prepare(`SELECT id, slug, name, description, sort_order FROM categories ORDER BY sort_order ASC, name ASC`),
    );
    const tagRows = await all<TagRow>(db.prepare(`SELECT id, slug, name FROM tags ORDER BY name ASC LIMIT 14`));

    const [featTagMap, latestGameTagMap, postTagMap, guideTagMap] = await Promise.all([
      tagsForGames(db, featuredRows.map((r) => r.id)),
      tagsForGames(db, latestGameRows.map((r) => r.id)),
      tagsForPosts(db, latestPostRows.map((r) => r.id)),
      tagsForGuides(db, latestGuideRows.map((r) => r.id)),
    ]);
    const catNameMap = await categoryNames(db, [
      ...featuredRows.map((r) => r.category_id),
      ...latestGameRows.map((r) => r.category_id),
    ]);

    const payload = {
      site: site
        ? { id: site.id, name: site.name, tagline: site.tagline, description: site.description }
        : { id: 1, name: "FreeGameplay", tagline: null, description: null },
      stats: counts,
      featuredGames: featuredRows.map((r) => {
        const g = gameRowToGame(r, featTagMap.get(r.id) ?? []);
        g.categoryName = r.category_name ?? null;
        return g;
      }),
      latestGames: latestGameRows.map((r) => {
        const g = gameRowToGame(r, latestGameTagMap.get(r.id) ?? []);
        g.categoryName = r.category_name ?? null;
        return g;
      }),
      latestPosts: latestPostRows.map((r) => postRowToPost(r, postTagMap.get(r.id) ?? [], false)),
      latestGuides: latestGuideRows.map((r) => guideRowToGuide(r, guideTagMap.get(r.id) ?? [], false)),
      categories: toCategories(categoryRows),
      tags: tagRowsToTags(tagRows),
    };
    await kvSetJson(c.env.CACHE, "home", payload, 60);
    return c.json(payload);
  });

  // ── Games ──────────────────────────────────────────────────────────────────
  app.get("/content/games", async (c) => {
    const q = c.req.query();
    const page = parsePageParam(q.page, 1);
    const pageSize = parsePageSize(q.pageSize);
    const sort: "featured" | "newest" | "oldest" | "title" =
      q.sort === "newest" || q.sort === "oldest" || q.sort === "title" ? q.sort : "featured";

    const where: string[] = [];
    const params: (string | number)[] = [];
    if (q.genre) {
      where.push(`(g.genre = ? OR g.genre = ?)`);
      params.push(q.genre, q.genre.replace(/^./, (ch) => ch.toUpperCase()));
    }
    if (q.q) {
      where.push(`(g.title LIKE ? OR g.tagline LIKE ?)`);
      const like = `%${q.q.replace(/[%_]/g, "")}%`;
      params.push(like, like);
    }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const orderBy =
      sort === "newest"
        ? `ORDER BY g.published_at DESC NULLS LAST`
        : sort === "oldest"
          ? `ORDER BY g.published_at ASC NULLS LAST`
          : sort === "title"
            ? `ORDER BY g.title ASC`
            : `ORDER BY g.featured DESC, g.trending DESC, g.published_at DESC NULLS LAST`;

    const total = (await one<{ n: number }>(
      c.env.DB.prepare(`SELECT COUNT(*) AS n FROM games g${whereSql}`).bind(...params),
    ))?.n ?? 0;
    const rows = await all<GameRow & { category_name: string | null }>(
      c.env.DB.prepare(`${GAMES_LIST_SQL}${whereSql} ${orderBy} LIMIT ? OFFSET ?`).bind(...params, pageSize, (page - 1) * pageSize),
    );
    const tagMap = await tagsForGames(c.env.DB, rows.map((r) => r.id));
    const catMap = await categoryNames(c.env.DB, rows.map((r) => r.category_id));
    const genres = (await all<{ genre: string }>(
      c.env.DB.prepare(`SELECT DISTINCT genre FROM games WHERE genre IS NOT NULL ORDER BY genre ASC`),
    )).map((r) => r.genre);

    return c.json({
      items: rows.map((r) => {
        const g = gameRowToGame(r, tagMap.get(r.id) ?? []);
        g.categoryName = r.category_name ?? null;
        return g;
      }),
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      genres,
    });
  });

  app.get("/content/games/:slug", async (c) => {
    const slug = c.req.param("slug");
    const db = c.env.DB;
    const row = await one<GameRow & { category_name: string | null }>(
      db.prepare(`${GAMES_LIST_SQL} WHERE g.slug = ?`).bind(slug),
    );
    if (!row) return c.json({ error: "not_found", message: `Game "${slug}" not found` }, 404);
    const tagMap = await tagsForGames(db, [row.id]);
    const relatedRows = await all<GameRow>(
      db.prepare(
        `${GAMES_LIST_SQL} WHERE g.id != ? AND (g.category_id = ? OR g.genre = ?) ORDER BY g.featured DESC, g.published_at DESC LIMIT 4`,
      ).bind(row.id, row.category_id ?? -1, row.genre ?? ""),
    );
    const relatedTagMap = await tagsForGames(db, relatedRows.map((r) => r.id));
    const relatedCatMap = await categoryNames(db, relatedRows.map((r) => r.category_id));

    const game = gameRowToGame(row, tagMap.get(row.id) ?? []);
    game.categoryName = row.category_name ?? null;
    return c.json({
      item: game,
      related: relatedRows.map((r) => {
        const g = gameRowToGame(r, relatedTagMap.get(r.id) ?? []);
        g.categoryName = relatedCatMap.get(r.category_id ?? -1) ?? null;
        return g;
      }),
    });
  });

  // ── Posts ──────────────────────────────────────────────────────────────────
  app.get("/content/posts", async (c) => {
    const q = c.req.query();
    const page = parsePageParam(q.page, 1);
    const pageSize = parsePageSize(q.pageSize);

    const where: string[] = [];
    const params: (string | number)[] = [];
    if (q.category) {
      where.push(`c.slug = ?`);
      params.push(q.category);
    }
    if (q.author) {
      where.push(`a.slug = ?`);
      params.push(q.author);
    }
    if (q.tag) {
      where.push(`EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.slug = ?)`);
      params.push(q.tag);
    }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const total = (await one<{ n: number }>(
      c.env.DB.prepare(
        `SELECT COUNT(*) AS n FROM posts p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN authors a ON a.id = p.author_id${whereSql}`,
      ).bind(...params),
    ))?.n ?? 0;
    const rows = await all<PostRow>(
      c.env.DB.prepare(`${POSTS_LIST_SQL}${whereSql} ORDER BY p.published_at DESC NULLS LAST LIMIT ? OFFSET ?`).bind(...params, pageSize, (page - 1) * pageSize),
    );
    const tagMap = await tagsForPosts(c.env.DB, rows.map((r) => r.id));
    return c.json({
      items: rows.map((r) => postRowToPost(r, tagMap.get(r.id) ?? [], false)),
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });

  app.get("/content/posts/:slug", async (c) => {
    const db = c.env.DB;
    const row = await one<PostRow>(db.prepare(`${POSTS_LIST_SQL} WHERE p.slug = ?`).bind(c.req.param("slug")));
    if (!row) return c.json({ error: "not_found", message: "Post not found" }, 404);
    const tagMap = await tagsForPosts(db, [row.id]);
    const relatedRows = await all<PostRow>(
      db.prepare(`${POSTS_LIST_SQL} WHERE p.id != ? AND p.category_id = ? ORDER BY p.published_at DESC LIMIT 4`).bind(row.id, row.category_id ?? -1),
    );
    const relatedTagMap = await tagsForPosts(db, relatedRows.map((r) => r.id));
    return c.json({
      item: postRowToPost(row, tagMap.get(row.id) ?? [], true),
      related: relatedRows.map((r) => postRowToPost(r, relatedTagMap.get(r.id) ?? [], false)),
    });
  });

  // ── Guides ─────────────────────────────────────────────────────────────────
  app.get("/content/guides", async (c) => {
    const q = c.req.query();
    const page = parsePageParam(q.page, 1);
    const pageSize = parsePageSize(q.pageSize);

    const where: string[] = [];
    const params: (string | number)[] = [];
    if (q.game) {
      where.push(`g.slug = ?`);
      params.push(q.game);
    }
    if (q.category) {
      where.push(`c.slug = ?`);
      params.push(q.category);
    }
    const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const total = (await one<{ n: number }>(
      c.env.DB.prepare(
        `SELECT COUNT(*) AS n FROM guides gu LEFT JOIN games g ON g.id = gu.game_id LEFT JOIN categories c ON c.id = gu.category_id${whereSql}`,
      ).bind(...params),
    ))?.n ?? 0;
    const rows = await all<GuideRow>(
      c.env.DB.prepare(`${GUIDES_LIST_SQL}${whereSql} ORDER BY gu.published_at DESC NULLS LAST LIMIT ? OFFSET ?`).bind(...params, pageSize, (page - 1) * pageSize),
    );
    const tagMap = await tagsForGuides(c.env.DB, rows.map((r) => r.id));
    return c.json({
      items: rows.map((r) => guideRowToGuide(r, tagMap.get(r.id) ?? [], false)),
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    });
  });

  app.get("/content/guides/:slug", async (c) => {
    const db = c.env.DB;
    const row = await one<GuideRow>(db.prepare(`${GUIDES_LIST_SQL} WHERE gu.slug = ?`).bind(c.req.param("slug")));
    if (!row) return c.json({ error: "not_found", message: "Guide not found" }, 404);
    const tagMap = await tagsForGuides(db, [row.id]);
    const relatedRows = await all<GuideRow>(
      db.prepare(`${GUIDES_LIST_SQL} WHERE gu.id != ? AND (gu.game_id = ? OR gu.category_id = ?) ORDER BY gu.published_at DESC LIMIT 3`).bind(row.id, row.game_id ?? -1, row.category_id ?? -1),
    );
    const relatedTagMap = await tagsForGuides(db, relatedRows.map((r) => r.id));
    return c.json({
      item: guideRowToGuide(row, tagMap.get(row.id) ?? [], true),
      related: relatedRows.map((r) => guideRowToGuide(r, relatedTagMap.get(r.id) ?? [], false)),
    });
  });

  // ── Categories / tags / pages ─────────────────────────────────────────────
  app.get("/content/categories", async (c) => {
    const rows = await all<{ id: number; slug: string; name: string; description: string | null; sort_order: number }>(
      c.env.DB.prepare(`SELECT id, slug, name, description, sort_order FROM categories ORDER BY sort_order ASC, name ASC`),
    );
    return c.json({ items: toCategories(rows) });
  });

  app.get("/content/categories/:slug", async (c) => {
    const db = c.env.DB;
    const cat = await one<{ id: number; slug: string; name: string; description: string | null; sort_order: number }>(
      db.prepare(`SELECT id, slug, name, description, sort_order FROM categories WHERE slug = ?`).bind(c.req.param("slug")),
    );
    if (!cat) return c.json({ error: "not_found", message: "Category not found" }, 404);
    const posts = await all<PostRow>(db.prepare(`${POSTS_LIST_SQL} WHERE p.category_id = ? ORDER BY p.published_at DESC LIMIT 8`).bind(cat.id));
    const games = await all<GameRow & { category_name: string | null }>(
      db.prepare(`${GAMES_LIST_SQL} WHERE g.category_id = ? ORDER BY g.featured DESC, g.published_at DESC LIMIT 8`).bind(cat.id),
    );
    const guides = await all<GuideRow>(db.prepare(`${GUIDES_LIST_SQL} WHERE gu.category_id = ? ORDER BY gu.published_at DESC LIMIT 4`).bind(cat.id));
    const [pt, gt, gtg] = await Promise.all([
      tagsForPosts(db, posts.map((r) => r.id)),
      tagsForGames(db, games.map((r) => r.id)),
      tagsForGuides(db, guides.map((r) => r.id)),
    ]);
    return c.json({
      category: toCategories([cat])[0],
      posts: posts.map((r) => postRowToPost(r, pt.get(r.id) ?? [], false)),
      games: games.map((r) => {
        const g = gameRowToGame(r, gt.get(r.id) ?? []);
        g.categoryName = r.category_name ?? null;
        return g;
      }),
      guides: guides.map((r) => guideRowToGuide(r, gtg.get(r.id) ?? [], false)),
    });
  });

  app.get("/content/tags", async (c) => {
    const cached = await kvGetJson<{ items: (Tag & { postCount: number })[] }>(c.env.CACHE, "tags");
    if (cached) return c.json(cached);
    // Post counts come from the junction table so the tag cloud reflects real
    // usage rather than an unused taxonomy row.
    const rows = await all<{ id: number; slug: string; name: string; post_count: number }>(
      c.env.DB.prepare(
        `SELECT t.id, t.slug, t.name,
                (SELECT COUNT(*) FROM post_tags pt JOIN posts p ON p.id = pt.post_id
                  WHERE pt.tag_id = t.id AND p.published_at IS NOT NULL) AS post_count
           FROM tags t
          ORDER BY post_count DESC, t.name ASC`,
      ),
    );
    const items = rows.map((r) => ({ ...tagRowsToTags([r])[0], postCount: Number(r.post_count) }));
    const payload = { items };
    await kvSetJson(c.env.CACHE, "tags", payload, 300);
    return c.json(payload);
  });

  app.get("/content/pages/:slug", async (c) => {
    const row = await one<{ id: number; slug: string; title: string; content_html: string; published_at: string | null; seo_title: string | null; seo_description: string | null }>(
      c.env.DB.prepare(`SELECT id, slug, title, content_html, published_at, seo_title, seo_description FROM pages WHERE slug = ?`).bind(c.req.param("slug")),
    );
    if (!row) return c.json({ error: "not_found", message: "Page not found" }, 404);
    return c.json({
      item: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        contentHtml: row.content_html,
        publishedAt: row.published_at,
        seoTitle: row.seo_title,
        seoDescription: row.seo_description,
      },
    });
  });

  return app;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache invalidation
// ─────────────────────────────────────────────────────────────────────────────

const LIST_KEYS: Record<string, string> = {
  posts: "posts",
  guides: "guides",
  games: "games",
  pages: "pages",
};

/**
 * Drop the cached payloads a content change can affect: the home feed, the
 * list for the kind that changed, the tag index, and the matching search
 * entries. Cheap insurance against an item lingering for its full TTL.
 */
export async function purgeContentCache(env: Bindings, table: string): Promise<void> {
  const keys = ["home", "tags", "categories", "authors"];
  const listKey = LIST_KEYS[table];
  if (listKey) keys.push(listKey);
  await Promise.all(
    keys.map(async (k) => {
      const listed = await env.CACHE.list({ prefix: `${k}:` });
      await Promise.all(listed.keys.map((key) => env.CACHE.delete(key.name)));
    }),
  );
}
