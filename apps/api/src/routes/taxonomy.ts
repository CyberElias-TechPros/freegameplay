// Author and tag archives.
//
// The frontend renders bylines and tag chips, and both were dead ends: the
// API could *filter* posts by author or tag but had no way to describe them.
// These endpoints give the archives something real to render (bio, avatar,
// post counts) and give the sitemap something to list.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { kvGetJson, kvSetJson } from "../lib/cache";
import { all, one } from "../lib/db";
import { postRowToPost, tagsForPosts, type PostRow } from "../serialize";
import type { AuthorDetailPayload, AuthorSummary, TagDetailPayload, TagSummary } from "@fg/shared";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

export function taxonomyApp() {
  const app = new Hono<Env>();

  // ── Authors ────────────────────────────────────────────────────────────────
  app.get("/content/authors", async (c) => {
    const cached = await kvGetJson<{ items: AuthorSummary[] }>(c.env.CACHE, "authors");
    if (cached) return c.json(cached);
    const rows = await all<{ id: number; slug: string; name: string; bio: string | null; avatar_url: string | null; post_count: number }>(
      c.env.DB.prepare(
        `SELECT a.id, a.slug, a.name, a.bio, a.avatar_url,
                (SELECT COUNT(*) FROM posts p WHERE p.author_id = a.id AND p.published_at IS NOT NULL) AS post_count
           FROM authors a ORDER BY post_count DESC, a.name ASC`,
      ),
    );
    const payload = {
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        bio: r.bio,
        avatarUrl: r.avatar_url,
        postCount: Number(r.post_count),
      })),
    };
    await kvSetJson(c.env.CACHE, "authors", payload, 300);
    return c.json(payload);
  });

  app.get("/content/authors/:slug", async (c) => {
    const slug = c.req.param("slug");
    const author = await one<{ id: number; slug: string; name: string; bio: string | null; avatar_url: string | null }>(
      c.env.DB.prepare(`SELECT id, slug, name, bio, avatar_url FROM authors WHERE slug = ?`).bind(slug),
    );
    if (!author) return c.json({ error: "not_found", message: `Author "${slug}" not found` }, 404);

    const rows = await all<PostRow>(
      c.env.DB.prepare(
        `SELECT p.*, a.name AS author_name, a.slug AS author_slug, c.name AS category_name
           FROM posts p
           LEFT JOIN authors a ON a.id = p.author_id
           LEFT JOIN categories c ON c.id = p.category_id
          WHERE p.author_id = ? AND p.published_at IS NOT NULL
          ORDER BY p.published_at DESC LIMIT 60`,
      ).bind(author.id),
    );
    const tagMap = await tagsForPosts(c.env.DB, rows.map((r) => r.id));
    const summary: AuthorSummary = {
      id: author.id,
      slug: author.slug,
      name: author.name,
      bio: author.bio,
      avatarUrl: author.avatar_url,
      postCount: rows.length,
    };
    const payload: AuthorDetailPayload = { author: summary, posts: rows.map((r) => postRowToPost(r, tagMap.get(r.id) ?? [], false)) };
    return c.json(payload, 200, { "Cache-Control": "public, max-age=120" });
  });

  // ── Tags ───────────────────────────────────────────────────────────────────
  app.get("/content/tags/:slug", async (c) => {
    const slug = c.req.param("slug");
    const tag = await one<{ id: number; slug: string; name: string }>(
      c.env.DB.prepare(`SELECT id, slug, name FROM tags WHERE slug = ?`).bind(slug),
    );
    if (!tag) return c.json({ error: "not_found", message: `Tag "${slug}" not found` }, 404);

    const rows = await all<PostRow>(
      c.env.DB.prepare(
        `SELECT p.*, a.name AS author_name, a.slug AS author_slug, c.name AS category_name
           FROM posts p
           JOIN post_tags pt ON pt.post_id = p.id
           LEFT JOIN authors a ON a.id = p.author_id
           LEFT JOIN categories c ON c.id = p.category_id
          WHERE pt.tag_id = ? AND p.published_at IS NOT NULL
          ORDER BY p.published_at DESC LIMIT 60`,
      ).bind(tag.id),
    );
    const tagMap = await tagsForPosts(c.env.DB, rows.map((r) => r.id));
    const summary: TagSummary = { id: tag.id, slug: tag.slug, name: tag.name, postCount: rows.length };
    const payload: TagDetailPayload = { tag: summary, posts: rows.map((r) => postRowToPost(r, tagMap.get(r.id) ?? [], false)) };
    return c.json(payload, 200, { "Cache-Control": "public, max-age=120" });
  });

  return app;
}
