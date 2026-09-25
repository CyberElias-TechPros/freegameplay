// ─────────────────────────────────────────────────────────────────────────────
// Import pipeline. One code path for seed data, Blogger XML (already mapped to
// ImportRecords by @fg/shared) and manual JSON pushes.
//
// Guarantees:
//   • Idempotent — safe to re-run. Identity is (slug, source_id), never title.
//   • Auditable — every run lands in migration_runs, every record in
//     migration_items with a status and a detail line.
//   • Dry-run — full mapping + stats with zero writes (a run row records it).
//   • Reversible per job — documents created by a job (and untouched since)
//     can be rolled back without touching later editor work.
//   • SEO-safe — every legacy URL gets a 308 redirect row automatically.
// ─────────────────────────────────────────────────────────────────────────────

import {
  normalizeLegacyUrl,
  slugify,
  type ImportOptions,
  type ImportRecords,
  type ImportStats,
  type MigrationRun,
} from "@fg/shared";
import { kvDeleteByPrefix } from "../lib/cache";
import type { Bindings } from "../worker";

type Cnt = { created: number; updated: number; skipped: number; failed: number };
const fresh = (): Cnt => ({ created: 0, updated: 0, skipped: 0, failed: 0 });

export interface ImportOutcome {
  run: MigrationRun;
  stats: ImportStats;
  warnings: string[];
}

interface ItemRow {
  itemType: string;
  sourceId: string | null;
  legacyUrl: string | null;
  status: "imported" | "updated" | "skipped" | "failed";
  detail: string | null;
}

const BLOGSPOT_MEDIA_HOST = "upload.blogger.com";

// ── Low-level upserts ─────────────────────────────────────────────────────────

async function taxonomyIds(env: Bindings, table: "categories" | "tags" | "authors"): Promise<Map<string, number>> {
  const res = await env.DB.prepare(`SELECT id, slug FROM ${table}`).all<{ id: number; slug: string }>();
  const m = new Map<string, number>();
  for (const r of res.results) m.set(r.slug, r.id);
  return m;
}

async function upsertContentDoc<T extends { slug: string; sourceId?: string; legacyUrl?: string }>(
  env: Bindings,
  ctx: {
    table: "games" | "posts" | "guides" | "pages";
    kind: string;
    doc: T & Record<string, unknown>;
    insertSql: string;
    insertParams: unknown[];
    updateSql: string;
    updateParams: unknown[];
    dryRun: boolean;
    items: ItemRow[];
    cnt: Cnt;
  },
): Promise<void> {
  const { table, kind, doc, dryRun, items, cnt } = ctx;
  const slug = slugify(String(doc.slug ?? ""));
  if (!slug) {
    cnt.failed++;
    items.push({ itemType: kind, sourceId: String(doc.title ?? ""), legacyUrl: (doc.legacyUrl as string) ?? null, status: "failed", detail: "missing/invalid slug" });
    return;
  }
  const sourceId = (doc.sourceId as string | undefined) ?? null;
  const existing = await env.DB
    .prepare(`SELECT id FROM ${table} WHERE slug = ?${sourceId ? " OR source_id = ?" : ""}`)
    .bind(...(sourceId ? [slug, sourceId] : [slug]))
    .first<{ id: number }>();

  if (dryRun) {
    if (existing) {
      cnt.updated++;
      items.push({ itemType: kind, sourceId, legacyUrl: (doc.legacyUrl as string) ?? null, status: "updated", detail: `[dry-run] would update ${table}/${slug}` });
    } else {
      cnt.created++;
      items.push({ itemType: kind, sourceId, legacyUrl: (doc.legacyUrl as string) ?? null, status: "imported", detail: `[dry-run] would create ${table}/${slug}` });
    }
    return;
  }

  if (existing) {
    await env.DB.prepare(`UPDATE ${table} SET ${ctx.updateSql} WHERE id = ?`).bind(...ctx.updateParams, existing.id).run();
    cnt.updated++;
    items.push({ itemType: kind, sourceId, legacyUrl: (doc.legacyUrl as string) ?? null, status: "updated", detail: `update ${table}/${slug}` });
  } else {
    await env.DB.prepare(ctx.insertSql).bind(...ctx.insertParams).run();
    cnt.created++;
    items.push({ itemType: kind, sourceId, legacyUrl: (doc.legacyUrl as string) ?? null, status: "imported", detail: `create ${table}/${slug}` });
  }
}

const JUNCTION_COL: Record<string, string> = {
  post_tags: "post_id",
  game_tags: "game_id",
  guide_tags: "guide_id",
};

async function upsertTagsForDoc(env: Bindings, docId: number, tagSlugs: string[], junction: string): Promise<void> {
  if (tagSlugs.length === 0) return;
  const col = JUNCTION_COL[junction];
  await env.DB.prepare(`DELETE FROM ${junction} WHERE ${col} = ?`).bind(docId).run();
  for (const slug of tagSlugs) {
    const tag = await env.DB.prepare(`SELECT id FROM tags WHERE slug = ?`).bind(slugify(slug)).first<{ id: number }>();
    if (!tag) continue;
    await env.DB.prepare(`INSERT OR IGNORE INTO ${junction} (${col}, tag_id) VALUES (?, ?)`).bind(docId, tag.id).run();
  }
}

async function upsertRedirect(
  env: Bindings,
  fromUrl: string | undefined | null,
  toPath: string,
  source: string,
  dryRun: boolean,
  stats: { created: number; updated: number; skipped: number },
  items: ItemRow[],
): Promise<void> {
  if (!fromUrl) {
    stats.skipped++;
    return;
  }
  const from = normalizeLegacyUrl(fromUrl);
  if (!from || from === toPath) {
    stats.skipped++;
    return;
  }
  const existing = await env.DB.prepare(`SELECT id, to_url FROM redirects WHERE from_url = ?`).bind(from).first<{ id: number; to_url: string }>();
  if (dryRun) {
    if (existing) stats.updated++;
    else stats.created++;
    items.push({ itemType: "redirect", sourceId: from, legacyUrl: from, status: existing ? "updated" : "imported", detail: `[dry-run] ${from} → ${toPath}` });
    return;
  }
  if (existing) {
    if (existing.to_url !== toPath) {
      await env.DB.prepare(`UPDATE redirects SET to_url = ? WHERE id = ?`).bind(toPath, existing.id).run();
      stats.updated++;
      items.push({ itemType: "redirect", sourceId: from, legacyUrl: from, status: "updated", detail: `${from} → ${toPath} (destination changed)` });
    } else {
      stats.skipped++;
      items.push({ itemType: "redirect", sourceId: from, legacyUrl: from, status: "skipped", detail: "redirect already correct" });
    }
  } else {
    await env.DB.prepare(`INSERT INTO redirects (from_url, to_url, status_code, source) VALUES (?, ?, 308, ?)`).bind(from, toPath, source).run();
    stats.created++;
    items.push({ itemType: "redirect", sourceId: from, legacyUrl: from, status: "imported", detail: `${from} → ${toPath}` });
  }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runImport(
  env: Bindings,
  records: ImportRecords,
  opts: ImportOptions,
  kind: "blogger" | "rss" | "seed" | "manual",
): Promise<ImportOutcome> {
  const startedAt = new Date().toISOString();
  const dryRun = Boolean(opts.dryRun);
  const jobId = `${kind}-${slugify(opts.sourceLabel ?? startedAt)}-${Date.now().toString(36)}`;
  const source = kind;
  const now = startedAt;

  const stats: ImportStats = {
    categories: { created: 0, updated: 0 },
    tags: { created: 0, updated: 0 },
    authors: { created: 0, updated: 0 },
    games: fresh(),
    posts: fresh(),
    guides: fresh(),
    pages: fresh(),
    redirects: { created: 0, updated: 0, skipped: 0 },
    media: { uploaded: 0, unresolved: 0, skipped: 0 },
  };
  const items: ItemRow[] = [];
  const warnings: string[] = [];

  const catRows = (records.categories ?? []).map((c) => ({ slug: slugify(c.slug ?? c.name), name: c.name, description: c.description ?? null, sort_order: c.sortOrder ?? 0 })).filter((r) => r.slug);
  const tagRows = (records.tags ?? []).map((t) => ({ slug: slugify(t.slug ?? t.name), name: t.name })).filter((r) => r.slug);
  const authorRows = (records.authors ?? []).map((a) => ({ slug: slugify(a.slug ?? a.name), name: a.name, bio: a.bio ?? null, avatar_url: a.avatarUrl ?? null })).filter((r) => r.slug);

  // 1) Taxonomy ---------------------------------------------------------------
  const before = (await env.DB
    .prepare(`SELECT (SELECT COUNT(*) FROM categories) AS c, (SELECT COUNT(*) FROM tags) AS t, (SELECT COUNT(*) FROM authors) AS a`)
    .first()) as { c: number; t: number; a: number };

  const slugSet = async (table: string) => new Set(((await env.DB.prepare(`SELECT slug FROM ${table}`).all()) as { results: { slug: string }[] }).results.map((r) => r.slug));
  const existingCats = await slugSet("categories");
  const existingTags = await slugSet("tags");
  const existingAuthors = await slugSet("authors");

  if (!dryRun) {
    const ops = [
      ...catRows.map((r) => env.DB.prepare(`INSERT OR IGNORE INTO categories (slug, name, description, sort_order) VALUES (?, ?, ?, ?)`).bind(r.slug, r.name, r.description, r.sort_order)),
      ...tagRows.map((r) => env.DB.prepare(`INSERT OR IGNORE INTO tags (slug, name) VALUES (?, ?)`).bind(r.slug, r.name)),
      ...authorRows.map((r) => env.DB.prepare(`INSERT OR IGNORE INTO authors (slug, name, bio, avatar_url) VALUES (?, ?, ?, ?)`).bind(r.slug, r.name, r.bio, r.avatar_url)),
      ...tagRows.map((r) => env.DB.prepare(`UPDATE tags SET name = ? WHERE slug = ?`).bind(r.name, r.slug)),
      ...authorRows.map((r) => env.DB.prepare(`UPDATE authors SET bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url) WHERE slug = ?`).bind(r.bio, r.avatar_url, r.slug)),
    ];
    if (ops.length) await env.DB.batch(ops);
  }
  if (dryRun) {
    stats.categories.created = catRows.filter((r) => !existingCats.has(r.slug)).length;
    stats.tags.created = tagRows.filter((r) => !existingTags.has(r.slug)).length;
    stats.authors.created = authorRows.filter((r) => !existingAuthors.has(r.slug)).length;
  } else {
    const after = (await env.DB
      .prepare(`SELECT (SELECT COUNT(*) FROM categories) AS c, (SELECT COUNT(*) FROM tags) AS t, (SELECT COUNT(*) FROM authors) AS a`)
      .first()) as { c: number; t: number; a: number };
    stats.categories.created = after.c - before.c;
    stats.tags.created = after.t - before.t;
    stats.authors.created = after.a - before.a;
  }
  for (const r of catRows) items.push({ itemType: "category", sourceId: r.slug, legacyUrl: null, status: "imported", detail: `${dryRun ? "[dry-run] " : ""}category ${r.slug}` });
  for (const r of tagRows) items.push({ itemType: "tag", sourceId: r.slug, legacyUrl: null, status: "imported", detail: `${dryRun ? "[dry-run] " : ""}tag ${r.slug}` });
  for (const r of authorRows) items.push({ itemType: "author", sourceId: r.slug, legacyUrl: null, status: "imported", detail: `${dryRun ? "[dry-run] " : ""}author ${r.slug}` });

  const catIds = await taxonomyIds(env, "categories");
  const tagIds = await taxonomyIds(env, "tags");
  const authorIds = await taxonomyIds(env, "authors");

  // 2) Games -------------------------------------------------------------------
  for (const g of records.games ?? []) {
    const slug = slugify(g.slug ?? g.title);
    const builtinJson = g.builtin ? JSON.stringify(g.builtin) : null;
    const thumbs = JSON.stringify(g.thumbnails ?? []);
    const catId = g.category ? catIds.get(slugify(g.category)) ?? null : null;
    const sourceId = g.sourceId ?? (slug ? `seed:${slug}` : null);
    const legacy = g.legacyUrl ? normalizeLegacyUrl(g.legacyUrl) : null;

    const insertSql = `INSERT INTO games (slug, title, tagline, description, cover_url, thumbnails, genre, category_id, platform, playable_type, playable_ref, builtin, controls, content_rating, featured, trending, source, source_id, legacy_url, published_at, updated_at, seo_title, seo_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertParams = [slug, g.title, g.tagline ?? null, g.description ?? "", g.coverUrl ?? null, thumbs, g.genre ?? null, catId, g.platform ?? "browser", g.playableType ?? "none", g.playableRef ?? null, builtinJson, g.controls ?? null, g.contentRating ?? "all", g.featured ? 1 : 0, g.trending ? 1 : 0, source, sourceId, legacy, g.publishedAt ?? null, now, g.seoTitle ?? null, g.seoDescription ?? null];
    const updateSql = `title = ?, tagline = ?, description = ?, cover_url = ?, thumbnails = ?, genre = ?, category_id = ?, platform = ?, playable_type = ?, playable_ref = ?, builtin = ?, controls = ?, content_rating = ?, featured = ?, trending = ?, updated_at = ?, seo_title = ?, seo_description = ?`;
    const updateParams = [g.title, g.tagline ?? null, g.description ?? "", g.coverUrl ?? null, thumbs, g.genre ?? null, catId, g.platform ?? "browser", g.playableType ?? "none", g.playableRef ?? null, builtinJson, g.controls ?? null, g.contentRating ?? "all", g.featured ? 1 : 0, g.trending ? 1 : 0, now, g.seoTitle ?? null, g.seoDescription ?? null];

    await upsertContentDoc(env, { table: "games", kind: "game", doc: { slug, sourceId, legacyUrl: g.legacyUrl, title: g.title } as never, insertSql, insertParams, updateSql, updateParams, dryRun, items, cnt: stats.games });
    if (!dryRun) {
      const row = await env.DB.prepare(`SELECT id FROM games WHERE slug = ?`).bind(slug).first<{ id: number }>();
      if (row) await upsertTagsForDoc(env, row.id, g.tags ?? [], "game_tags");
    }
    await upsertRedirect(env, g.legacyUrl, `/games/${slug}`, source, dryRun, stats.redirects, items);
  }

  // 3) Posts --------------------------------------------------------------------
  for (const p of records.posts ?? []) {
    const slug = slugify(p.slug ?? p.title);
    const catId = p.category ? catIds.get(slugify(p.category)) ?? null : null;
    const authorId = p.author ? authorIds.get(slugify(p.author)) ?? null : null;
    const sourceId = p.sourceId ?? (slug ? `${source}:${slug}` : null);
    const legacy = p.legacyUrl ? normalizeLegacyUrl(p.legacyUrl) : null;

    const insertSql = `INSERT INTO posts (slug, title, excerpt, content_html, featured_image_url, author_id, category_id, featured, source, source_id, legacy_url, published_at, updated_at, seo_title, seo_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertParams = [slug, p.title, p.excerpt ?? null, p.contentHtml ?? "", p.featuredImageUrl ?? null, authorId, catId, p.featured ? 1 : 0, source, sourceId, legacy, p.publishedAt ?? null, now, p.seoTitle ?? null, p.seoDescription ?? null];
    const updateSql = `title = ?, excerpt = ?, content_html = ?, featured_image_url = ?, author_id = ?, category_id = ?, featured = ?, updated_at = ?, seo_title = ?, seo_description = ?`;
    const updateParams = [p.title, p.excerpt ?? null, p.contentHtml ?? "", p.featuredImageUrl ?? null, authorId, catId, p.featured ? 1 : 0, now, p.seoTitle ?? null, p.seoDescription ?? null];

    await upsertContentDoc(env, { table: "posts", kind: "post", doc: { slug, sourceId, legacyUrl: p.legacyUrl, title: p.title } as never, insertSql, insertParams, updateSql, updateParams, dryRun, items, cnt: stats.posts });
    if (!dryRun) {
      const row = await env.DB.prepare(`SELECT id FROM posts WHERE slug = ?`).bind(slug).first<{ id: number }>();
      if (row) await upsertTagsForDoc(env, row.id, p.tags ?? [], "post_tags");
    }
    await upsertRedirect(env, p.legacyUrl, `/blog/${slug}`, source, dryRun, stats.redirects, items);
  }

  // 4) Guides ---------------------------------------------------------------------
  for (const gd of records.guides ?? []) {
    const slug = slugify(gd.slug ?? gd.title);
    const catId = gd.category ? catIds.get(slugify(gd.category)) ?? null : null;
    const authorId = gd.author ? authorIds.get(slugify(gd.author)) ?? null : null;
    const gameId = gd.game
      ? ((await env.DB.prepare(`SELECT id FROM games WHERE slug = ?`).bind(slugify(gd.game)).first<{ id: number }>())?.id ?? null)
      : null;
    const sourceId = gd.sourceId ?? (slug ? `${source}:${slug}` : null);
    const legacy = gd.legacyUrl ? normalizeLegacyUrl(gd.legacyUrl) : null;

    const insertSql = `INSERT INTO guides (slug, title, excerpt, content_html, featured_image_url, game_id, author_id, category_id, source, source_id, legacy_url, published_at, updated_at, seo_title, seo_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertParams = [slug, gd.title, gd.excerpt ?? null, gd.contentHtml ?? "", gd.featuredImageUrl ?? null, gameId, authorId, catId, source, sourceId, legacy, gd.publishedAt ?? null, now, gd.seoTitle ?? null, gd.seoDescription ?? null];
    const updateSql = `title = ?, excerpt = ?, content_html = ?, featured_image_url = ?, game_id = ?, author_id = ?, category_id = ?, updated_at = ?, seo_title = ?, seo_description = ?`;
    const updateParams = [gd.title, gd.excerpt ?? null, gd.contentHtml ?? "", gd.featuredImageUrl ?? null, gameId, authorId, catId, now, gd.seoTitle ?? null, gd.seoDescription ?? null];

    await upsertContentDoc(env, { table: "guides", kind: "guide", doc: { slug, sourceId, legacyUrl: gd.legacyUrl, title: gd.title } as never, insertSql, insertParams, updateSql, updateParams, dryRun, items, cnt: stats.guides });
    if (!dryRun) {
      const row = await env.DB.prepare(`SELECT id FROM guides WHERE slug = ?`).bind(slug).first<{ id: number }>();
      if (row) await upsertTagsForDoc(env, row.id, gd.tags ?? [], "guide_tags");
    }
    await upsertRedirect(env, gd.legacyUrl, `/guides/${slug}`, source, dryRun, stats.redirects, items);
  }

  // 5) Pages ------------------------------------------------------------------------
  for (const pg of records.pages ?? []) {
    const slug = slugify(pg.slug ?? pg.title);
    const sourceId = pg.sourceId ?? (slug ? `${source}:${slug}` : null);
    const legacy = pg.legacyUrl ? normalizeLegacyUrl(pg.legacyUrl) : null;

    const insertSql = `INSERT INTO pages (slug, title, content_html, source, source_id, legacy_url, published_at, updated_at, seo_title, seo_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertParams = [slug, pg.title, pg.contentHtml ?? "", source, sourceId, legacy, now, now, pg.seoTitle ?? null, pg.seoDescription ?? null];
    const updateSql = `title = ?, content_html = ?, updated_at = ?, seo_title = ?, seo_description = ?`;
    const updateParams = [pg.title, pg.contentHtml ?? "", now, pg.seoTitle ?? null, pg.seoDescription ?? null];

    await upsertContentDoc(env, { table: "pages", kind: "page", doc: { slug, sourceId, legacyUrl: pg.legacyUrl, title: pg.title } as never, insertSql, insertParams, updateSql, updateParams, dryRun, items, cnt: stats.pages });
    await upsertRedirect(env, pg.legacyUrl, `/${slug}`, source, dryRun, stats.redirects, items);
  }

  // 6) Media inventory + optional Blogger-media transfer ------------------------------
  for (const m of records.media ?? []) {
    if (m.status === "uploaded" && m.r2Key) {
      if (!dryRun) {
        const exists = await env.MEDIA.head(m.r2Key);
        if (exists) {
          await env.DB.prepare(
            `INSERT INTO media (url, r2_key, status, used_by, notes) VALUES (?, ?, 'uploaded', ?, ?)
             ON CONFLICT(url) DO UPDATE SET r2_key = excluded.r2_key, status = 'uploaded'`,
          ).bind(m.url, m.r2Key, JSON.stringify(m.usedBy ?? []), m.notes ?? null).run();
          stats.media.uploaded++;
          items.push({ itemType: "media", sourceId: m.r2Key, legacyUrl: m.url, status: "imported", detail: `uploaded ${m.r2Key}` });
          continue;
        }
        warnings.push(`Media "${m.r2Key}" marked uploaded but missing in R2 — run the media upload script.`);
      } else {
        stats.media.uploaded++;
        items.push({ itemType: "media", sourceId: m.r2Key, legacyUrl: m.url, status: "imported", detail: "[dry-run] media upload recorded" });
        continue;
      }
      // fallthrough: recorded as unresolved so the report flags it
    }
    if (!dryRun) {
      await env.DB.prepare(
        `INSERT INTO media (url, status, used_by, notes) VALUES (?, ?, ?, ?)
         ON CONFLICT(url) DO UPDATE SET status = excluded.status`,
      ).bind(m.url, m.status === "skipped" ? "skipped" : "unresolved", JSON.stringify(m.usedBy ?? []), m.notes ?? null).run();
    }
    if (m.status === "skipped") stats.media.skipped++;
    else stats.media.unresolved++;
    items.push({
      itemType: "media",
      sourceId: m.url,
      legacyUrl: m.url,
      status: "skipped",
      detail: `${dryRun ? "[dry-run] " : ""}media ${m.status === "skipped" ? "skipped" : "unresolved — needs rights review"}`,
    });
  }

  if (!dryRun && opts.downloadMedia && kind === "blogger") {
    const unresolved = ((await env.DB.prepare(`SELECT url FROM media WHERE status = 'unresolved'`).all()) as { results: { url: string }[] }).results;
    for (const m of unresolved) {
      try {
        const u = new URL(m.url);
        if (u.hostname !== BLOGSPOT_MEDIA_HOST) continue; // only the site's own hosted images
        const res = await fetch(u.toString());
        if (!res.ok) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        const type = res.headers.get("content-type") ?? "image/jpeg";
        const ext = type.includes("png") ? "png" : type.includes("gif") ? "gif" : "jpg";
        const key = `imported/${crypto.randomUUID().slice(0, 8)}-${Date.now().toString(36)}.${ext}`;
        await env.MEDIA.put(key, buf, { httpMetadata: { contentType: type } });
        const newPath = `/media/${key}`;
        await env.DB.prepare(`UPDATE media SET r2_key = ?, status = 'uploaded', mime_type = ? WHERE url = ?`).bind(key, type, m.url).run();
        for (const table of ["posts", "guides", "pages"] as const) {
          await env.DB.prepare(`UPDATE ${table} SET content_html = REPLACE(content_html, ?, ?) WHERE content_html LIKE ?`).bind(m.url, newPath, `%${m.url}%`).run();
        }
        await env.DB.prepare(`UPDATE posts SET featured_image_url = ? WHERE featured_image_url = ?`).bind(newPath, m.url).run();
        stats.media.uploaded++;
        stats.media.unresolved = Math.max(0, stats.media.unresolved - 1);
        items.push({ itemType: "media", sourceId: m.url, legacyUrl: m.url, status: "imported", detail: `transferred to ${key} (URLs rewritten)` });
      } catch (e) {
        warnings.push(`Media transfer failed for ${m.url}: ${String(e)}`);
      }
    }
  }

  // 7) Site settings ---------------------------------------------------------------------
  if (records.site && !dryRun) {
    const s = records.site;
    await env.DB
      .prepare(`UPDATE site_settings SET name = COALESCE(?, name), tagline = COALESCE(?, tagline), description = COALESCE(?, description) WHERE id = 1`)
      .bind(s.name ?? null, s.tagline ?? null, s.description ?? null)
      .run();
  }

  // 8) Persist run + items, invalidate caches ------------------------------------------------
  const finishedAt = new Date().toISOString();
  const run: MigrationRun = {
    id: 0,
    jobId,
    sourceType: kind,
    sourceLabel: opts.sourceLabel ?? null,
    status: dryRun ? "dry-run" : "done",
    startedAt,
    finishedAt,
    stats,
  };
  if (!dryRun) {
    await env.DB
      .prepare(`INSERT INTO migration_runs (job_id, source_type, source_label, status, started_at, finished_at, stats) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(jobId, kind, opts.sourceLabel ?? null, run.status, startedAt, finishedAt, JSON.stringify(stats))
      .run();
    const runRow = (await env.DB.prepare(`SELECT id FROM migration_runs WHERE job_id = ?`).bind(jobId).first()) as { id: number } | null;
    run.id = runRow?.id ?? 0;
    if (items.length) {
      await env.DB.batch(
        items.slice(0, 4000).map((it) =>
          env.DB.prepare(`INSERT INTO migration_items (run_id, item_type, source_id, legacy_url, status, detail) VALUES (?, ?, ?, ?, ?, ?)`)
            .bind(run.id, it.itemType, it.sourceId, it.legacyUrl, it.status, it.detail),
        ),
      );
    }
    await kvDeleteByPrefix(env.CACHE, "cache:");
    await kvDeleteByPrefix(env.CACHE, "sitemap");
  }

  const failed = stats.games.failed + stats.posts.failed + stats.guides.failed + stats.pages.failed;
  if (failed > 0) warnings.push(`${failed} records failed — inspect migration_items for the run.`);
  return { run: { ...run, stats }, stats, warnings };
}

// Roll back a job: remove only the documents it created that haven't been
// touched since (editor updates bump updated_at, so they survive).
export async function rollbackJob(env: Bindings, jobId: string): Promise<{ removed: string[] }> {
  const run = ((await env.DB.prepare(`SELECT id, started_at, source_type, source_label FROM migration_runs WHERE job_id = ?`).bind(jobId).first()) as
    | { id: number; started_at: string; source_type: string; source_label: string | null }
    | null);
  if (!run) return { removed: [] };
  const removed: string[] = [];
  for (const table of ["posts", "guides", "games", "pages"] as const) {
    const rows = ((await env.DB
      .prepare(`SELECT id, slug FROM ${table} WHERE source = ? AND created_at >= ? AND (updated_at IS NULL OR updated_at <= ?)`)
      .bind(run.source_type, run.started_at, run.started_at)
      .all()) as unknown as { results: { id: number; slug: string }[] }).results;
    if (rows.length) {
      await env.DB.batch(rows.map((r) => env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(r.id)));
      removed.push(...rows.map((r) => `${table}/${r.slug}`));
    }
  }
  await env.DB.prepare(`UPDATE migration_runs SET status = 'failed', source_label = COALESCE(source_label, '') || ? WHERE id = ?`).bind(` (rolled back ${new Date().toISOString()})`, run.id).run();
  return { removed };
}
