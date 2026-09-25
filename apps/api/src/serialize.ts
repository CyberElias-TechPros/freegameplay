// D1 row → shared typed payload. Kept in one place so every route
// serialises identically (no contract drift).

import { readingTime, type BuiltinGameConfig, type Category, type Game, type Guide, type Post, type Tag } from "@fg/shared";

// ── Rows ──────────────────────────────────────────────────────────────────────

export interface GameRow {
  id: number;
  slug: string;
  title: string;
  tagline: string | null;
  description: string;
  cover_url: string | null;
  thumbnails: string;
  genre: string | null;
  category_id: number | null;
  platform: string;
  playable_type: "builtin" | "external" | "none";
  playable_ref: string | null;
  builtin: string | null;
  controls: string | null;
  content_rating: string;
  featured: number;
  trending: number;
  leaderboard_enabled: number;
  source: "seed" | "blogger" | "manual";
  source_id: string | null;
  legacy_url: string | null;
  published_at: string | null;
  updated_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

export interface PostRow {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html?: string;
  featured_image_url: string | null;
  author_id: number | null;
  author_name: string | null;
  author_slug: string | null;
  category_id: number | null;
  category_name: string | null;
  featured: number;
  source: "seed" | "blogger" | "manual";
  source_id: string | null;
  legacy_url: string | null;
  published_at: string | null;
  updated_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

export interface GuideRow {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content_html?: string;
  featured_image_url: string | null;
  game_id: number | null;
  game_title: string | null;
  game_slug: string | null;
  author_id: number | null;
  author_name: string | null;
  author_slug: string | null;
  category_id: number | null;
  category_name: string | null;
  source: "seed" | "blogger" | "manual";
  source_id: string | null;
  legacy_url: string | null;
  published_at: string | null;
  updated_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

export interface TagRow {
  id: number;
  slug: string;
  name: string;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function tagRowsToTags(rows: TagRow[]): Tag[] {
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name }));
}

export function gameRowToGame(row: GameRow, tags: Tag[]): Game {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    description: row.description,
    coverUrl: row.cover_url,
    thumbnails: parseJson<{ url: string; alt: string }[]>(row.thumbnails, []),
    genre: row.genre,
    categoryId: row.category_id,
    categoryName: (row as GameRow & { category_name?: string | null }).category_name ?? null,
    platform: row.platform,
    playableType: row.playable_type,
    playableRef: row.playable_ref,
    builtin: parseJson<BuiltinGameConfig | null>(row.builtin, null),
    controls: row.controls,
    contentRating: row.content_rating,
    featured: row.featured === 1,
    trending: row.trending === 1,
    leaderboardEnabled: row.leaderboard_enabled === 1,
    source: row.source,
    sourceId: row.source_id,
    legacyUrl: row.legacy_url,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    tags,
  };
}

export function postRowToPost(row: PostRow, tags: Tag[], includeContent: boolean): Post {
  const out: Post = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    featuredImageUrl: row.featured_image_url,
    authorId: row.author_id,
    authorName: row.author_name,
    authorSlug: row.author_slug,
    categoryId: row.category_id,
    categoryName: row.category_name,
    featured: row.featured === 1,
    source: row.source,
    sourceId: row.source_id,
    legacyUrl: row.legacy_url,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    readingMinutes: includeContent && row.content_html
      ? readingTime(row.content_html)
      : Math.max(1, Math.round((row.excerpt?.length ?? 0) / 60) || 2),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    tags,
  };
  if (includeContent && row.content_html) out.contentHtml = row.content_html;
  return out;
}

export function guideRowToGuide(row: GuideRow, tags: Tag[], includeContent: boolean): Guide {
  const out: Guide = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    featuredImageUrl: row.featured_image_url,
    gameId: row.game_id,
    gameTitle: row.game_title,
    gameSlug: row.game_slug,
    authorId: row.author_id,
    authorName: row.author_name,
    authorSlug: row.author_slug ?? null,
    categoryId: row.category_id,
    categoryName: row.category_name,
    source: row.source,
    sourceId: row.source_id,
    legacyUrl: row.legacy_url,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    readingMinutes: includeContent && row.content_html
      ? readingTime(row.content_html)
      : Math.max(1, Math.round((row.excerpt?.length ?? 0) / 60) || 2),
    tags,
  };
  if (includeContent && row.content_html) out.contentHtml = row.content_html;
  return out;
}

// ── Tag join helpers ──────────────────────────────────────────────────────────

export async function tagsForGames(db: D1Database, gameIds: number[]): Promise<Map<number, Tag[]>> {
  const map = new Map<number, Tag[]>();
  if (gameIds.length === 0) return map;
  const res = await db
    .prepare(
      `SELECT gt.game_id AS gid, t.id, t.slug, t.name
       FROM game_tags gt JOIN tags t ON t.id = gt.tag_id
       WHERE gt.game_id IN (${gameIds.map(() => "?").join(",")})
       ORDER BY t.name`,
    )
    .bind(...gameIds)
    .all<{ gid: number; id: number; slug: string; name: string }>();
  for (const r of res.results) {
    const list = map.get(r.gid) ?? [];
    list.push({ id: r.id, slug: r.slug, name: r.name });
    map.set(r.gid, list);
  }
  return map;
}

export async function tagsForPosts(db: D1Database, postIds: number[]): Promise<Map<number, Tag[]>> {
  return tagsForTable(db, "post_tags", "post_id", postIds);
}

export async function tagsForGuides(db: D1Database, guideIds: number[]): Promise<Map<number, Tag[]>> {
  return tagsForTable(db, "guide_tags", "guide_id", guideIds);
}

async function tagsForTable(
  db: D1Database,
  junction: string,
  docCol: string,
  docIds: number[],
): Promise<Map<number, Tag[]>> {
  const map = new Map<number, Tag[]>();
  if (docIds.length === 0) return map;
  const res = await db
    .prepare(
      `SELECT ${docCol} AS did, t.id, t.slug, t.name
       FROM ${junction} j JOIN tags t ON t.id = j.tag_id
       WHERE j.${docCol} IN (${docIds.map(() => "?").join(",")})
       ORDER BY t.name`,
    )
    .bind(...docIds)
    .all<{ did: number; id: number; slug: string; name: string }>();
  for (const r of res.results) {
    const list = map.get(r.did) ?? [];
    list.push({ id: r.id, slug: r.slug, name: r.name });
    map.set(r.did, list);
  }
  return map;
}

export async function categoryNames(db: D1Database, categoryIds: (number | null)[]): Promise<Map<number, string>> {
  const ids = [...new Set(categoryIds.filter((c): c is number => c !== null))];
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  const res = await db
    .prepare(`SELECT id, name FROM categories WHERE id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<{ id: number; name: string }>();
  for (const r of res.results) map.set(r.id, r.name);
  return map;
}

export function toCategories(rows: { id: number; slug: string; name: string; description: string | null; sort_order: number }[]): Category[] {
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    sortOrder: r.sort_order,
  }));
}
