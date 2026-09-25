// Moderated comments for blog posts and guides.
//
//   GET  /api/content/:type/:slug/comments   → approved, threaded one level
//   POST /api/comments                       → queue a comment for moderation
//
// Design decisions that matter for a public site:
//   • Nothing is published on submission. Every comment lands as `pending` and
//     appears only after an admin approves it in the console.
//   • Author emails are stored but never rendered publicly — they exist so the
//     owner can reply out-of-band and so repeat commenters can be recognised.
//   • Honeypot field + IP/day rate limit + a light spam heuristic. Real
//     moderation stays human, which is the only thing that actually works.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { one } from "../lib/db";
import { visitorHash } from "../lib/identity";
import { rateLimit } from "../lib/rate";
import { badRequest, notFound } from "../lib/respond";
import { cleanText, LIMITS, looksLikeSpam, slugish } from "../lib/validate";
import type { CommentNode, CommentsPayload, SubmitCommentPayload } from "@fg/shared";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

const PER_DAY = 5;

export function commentsApp() {
  const app = new Hono<Env>();

  // ── Public: approved comments for a document ───────────────────────────────
  app.get("/content/:type/:slug/comments", async (c) => {
    // Accept both the singular ("post") and plural ("posts") form: the detail
    // routes are plural and this one was singular, which is an easy way to get
    // a confusing 404 from a correct-looking URL.
    const raw = c.req.param("type");
    const type = raw === "post" || raw === "posts" ? "post" : raw === "guide" || raw === "guides" ? "guide" : null;
    if (!type) return notFound(c, "Comments exist on posts and guides only");
    const slug = slugish(c.req.param("slug"));
    if (!slug) return notFound(c, "Unknown document");

    const table = type === "post" ? "posts" : "guides";
    const doc = await one<{ id: number }>(c.env.DB.prepare(`SELECT id FROM ${table} WHERE slug = ?`).bind(slug));
    if (!doc) return notFound(c, `No ${type} at "${slug}"`);

    const rows = (
      await c.env.DB.prepare(
        `SELECT id, parent_id, author_name, body, created_at
           FROM comments
          WHERE target_type = ? AND target_slug = ? AND status = 'approved'
          ORDER BY created_at ASC LIMIT 500`,
      )
        .bind(type, slug)
        .all<{ id: number; parent_id: number | null; author_name: string; body: string; created_at: string }>()
    ).results;

    const byId = new Map<number, CommentNode>();
    for (const r of rows) byId.set(r.id, { id: r.id, parentId: r.parent_id, authorName: r.author_name, body: r.body, createdAt: r.created_at, replies: [] });

    const roots: CommentNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.replies.push(node);
      else roots.push(node);
    }

    const payload: CommentsPayload = {
      targetType: type,
      targetSlug: slug,
      total: rows.length,
      comments: roots,
    };
    return c.json(payload, 200, { "Cache-Control": "public, max-age=60" });
  });

  return app;
}

// ── Submission (public, unauthenticated) ─────────────────────────────────────

export function commentSubmitApp() {
  const app = new Hono<Env>();

  app.post("/comments", async (c) => {
    const limited = await rateLimit(c, c.env.CACHE, "comment", 10, 3600);
    if (limited) return limited;

    const body = (await c.req.json().catch(() => null)) as SubmitCommentPayload | null;
    if (!body) return badRequest(c, "JSON body required");

    const type = body.targetType;
    if (type !== "post" && type !== "guide") return badRequest(c, "targetType must be \"post\" or \"guide\"");
    const slug = slugish(body.targetSlug);
    if (!slug) return badRequest(c, "A valid target slug is required");

    const table = type === "post" ? "posts" : "guides";
    const doc = await one<{ id: number }>(c.env.DB.prepare(`SELECT id FROM ${table} WHERE slug = ?`).bind(slug));
    if (!doc) return notFound(c, `No ${type} at "${slug}"`);

    // Honeypot — a hidden field only a bot fills in.
    if (typeof body.website === "string" && body.website.trim().length > 0) {
      // Pretend success: don't tell the bot it failed.
      return c.json({ ok: true, status: "pending", message: "Thanks — your comment is awaiting moderation." }, 201);
    }

    const authorName = cleanText(body.authorName, LIMITS.name.max);
    if (authorName.length < LIMITS.name.min) return badRequest(c, `A name of ${LIMITS.name.min}–${LIMITS.name.max} characters is required`);
    const text = cleanText(body.body, LIMITS.commentBody.max);
    if (text.length < LIMITS.commentBody.min) return badRequest(c, `Comments must be at least ${LIMITS.commentBody.min} characters`);
    const email = typeof body.authorEmail === "string" && body.authorEmail.trim() ? body.authorEmail.trim().slice(0, LIMITS.email.max) : null;

    if (looksLikeSpam(text)) {
      return c.json({ ok: true, status: "pending", message: "Thanks — your comment is awaiting moderation." }, 201);
    }

    let parentId: number | null = null;
    if (body.parentId !== undefined && body.parentId !== null) {
      const parent = await one<{ id: number; target_slug: string; status: string }>(
        c.env.DB.prepare(`SELECT id, target_slug, status FROM comments WHERE id = ?`).bind(Number(body.parentId)),
      );
      // Replies only attach to an approved comment on the same document.
      if (parent && parent.target_slug === slug && parent.status === "approved") parentId = parent.id;
    }

    const hash = await visitorHash(c, c.env.ANALYTICS_SALT);
    const today = new Date().toISOString().slice(0, 10);
    const used = ((await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM comments WHERE client_hash = ? AND created_at >= ?`).bind(hash, today).first()) as { n: number } | null)?.n ?? 0;
    if (used >= PER_DAY) {
      return c.json({ error: "rate_limited", message: "You've reached the daily comment limit. Try again tomorrow." }, 429, { "Retry-After": "3600" });
    }

    await c.env.DB.prepare(
      `INSERT INTO comments (target_type, target_slug, parent_id, author_name, author_email, body, status, client_hash)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
      .bind(type, slug, parentId, authorName, email, text, hash)
      .run();

    return c.json({ ok: true, status: "pending", message: "Thanks — your comment is awaiting moderation." }, 201);
  });

  return app;
}
