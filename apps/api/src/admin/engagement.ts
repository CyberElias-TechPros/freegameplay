// Admin surface for the engagement features: comment moderation, subscriber
// management, leaderboard oversight and the analytics report.
//
// All of these are mounted behind the admin token gate in admin.ts. They are
// the human half of every flow the public endpoints start — a comment isn't
// "published" until it is approved here, a subscriber isn't "on the list"
// until they confirm, and a score isn't trustworthy until it can be reviewed.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono, type Context } from "hono";
import { badRequest } from "../lib/respond";
import { buildAnalyticsReport } from "../routes/analytics";
import { listScores } from "../routes/scores";
import type { AdminComment, AdminOverview, Subscriber } from "@fg/shared";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

function assertAdmin(c: Context): Response | null {
  const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? c.req.header("x-admin-token") ?? "";
  const expected = c.env.ADMIN_TOKEN;
  if (!expected || token !== expected) {
    return c.json({ error: "unauthorized", message: "Invalid or missing admin token" }, 401);
  }
  return null;
}

export function engagementAdminApp() {
  const app = new Hono<Env>();

  app.use("/admin/*", async (c, next) => {
    const denied = assertAdmin(c);
    if (denied) return denied;
    await next();
  });

  // ── Dashboard overview (one call for the console's landing view) ───────────
  app.get("/admin/overview", async (c) => {
    const db = c.env.DB;
    const days = Math.min(365, Math.max(1, Number(c.req.query("days") ?? 30) || 30));

    let checks = { db: false, r2: false, kv: false };
    try {
      await db.prepare(`SELECT 1`).first();
      checks.db = true;
    } catch {
      /* false */
    }
    try {
      await c.env.MEDIA.list({ limit: 1 });
      checks.r2 = true;
    } catch {
      /* false */
    }
    try {
      await c.env.CACHE.put("health:probe", "1", { expirationTtl: 60 });
      checks.kv = (await c.env.CACHE.get("health:probe")) === "1";
    } catch {
      /* false */
    }

    const scalar = async (sql: string): Promise<number> => {
      const row = (await db.prepare(sql).first()) as Record<string, number> | null;
      return row ? Number(Object.values(row)[0] ?? 0) : 0;
    };

    const overview: AdminOverview = {
      health: { ok: checks.db && checks.r2 && checks.kv, checks },
      counts: {
        games: await scalar(`SELECT COUNT(*) AS n FROM games`),
        posts: await scalar(`SELECT COUNT(*) AS n FROM posts`),
        guides: await scalar(`SELECT COUNT(*) AS n FROM guides`),
        pages: await scalar(`SELECT COUNT(*) AS n FROM pages`),
        redirects: await scalar(`SELECT COUNT(*) AS n FROM redirects`),
        messages: await scalar(`SELECT COUNT(*) AS n FROM messages WHERE status = 'new'`),
        comments: {
          pending: await scalar(`SELECT COUNT(*) AS n FROM comments WHERE status = 'pending'`),
          approved: await scalar(`SELECT COUNT(*) AS n FROM comments WHERE status = 'approved'`),
          rejected: await scalar(`SELECT COUNT(*) AS n FROM comments WHERE status = 'rejected'`),
        },
        subscribers: {
          pending: await scalar(`SELECT COUNT(*) AS n FROM subscribers WHERE status = 'pending'`),
          confirmed: await scalar(`SELECT COUNT(*) AS n FROM subscribers WHERE status = 'confirmed'`),
          unsubscribed: await scalar(`SELECT COUNT(*) AS n FROM subscribers WHERE status = 'unsubscribed'`),
        },
        scores: await scalar(`SELECT COUNT(*) AS n FROM scores`),
        mediaUnresolved: await scalar(`SELECT COUNT(*) AS n FROM media WHERE status = 'unresolved'`),
      },
      analytics: await buildAnalyticsReport(db, days),
      recentMessages: (
        await db
          .prepare(`SELECT id, name, email, subject, status, created_at FROM messages ORDER BY created_at DESC LIMIT 8`)
          .all<{ id: number; name: string; email: string; subject: string | null; status: string; created_at: string }>()
      ).results.map((r) => ({ id: r.id, name: r.name, email: r.email, subject: r.subject, createdAt: r.created_at, status: r.status })),
    };
    return c.json(overview);
  });

  // ── Analytics ──────────────────────────────────────────────────────────────
  app.get("/admin/analytics", async (c) => {
    const days = Math.min(365, Math.max(1, Number(c.req.query("days") ?? 30) || 30));
    return c.json(await buildAnalyticsReport(c.env.DB, days));
  });

  // ── Comments ───────────────────────────────────────────────────────────────
  app.get("/admin/comments", async (c) => {
    const status = c.req.query("status");
    const where = status && ["pending", "approved", "rejected"].includes(status) ? `WHERE status = ?` : "";
    const params = where ? [status] : [];
    const rows = (
      await c.env.DB.prepare(`SELECT * FROM comments ${where} ORDER BY created_at DESC LIMIT 300`).bind(...params).all()
    ).results as unknown as {
      id: number;
      target_type: string;
      target_slug: string;
      parent_id: number | null;
      author_name: string;
      author_email: string | null;
      body: string;
      status: string;
      created_at: string;
    }[];
    const items: AdminComment[] = rows.map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetSlug: r.target_slug,
      parentId: r.parent_id,
      authorName: r.author_name,
      authorEmail: r.author_email,
      body: r.body,
      status: r.status as AdminComment["status"],
      createdAt: r.created_at,
    }));
    const byStatus = (
      await c.env.DB.prepare(`SELECT status, COUNT(*) AS n FROM comments GROUP BY status`).all<{ status: string; n: number }>()
    ).results;
    return c.json({
      items,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])),
    });
  });

  app.post("/admin/comments/:id/status", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { status?: string } | null;
    const status = body?.status;
    if (!status || !["approved", "rejected", "pending"].includes(status)) {
      return badRequest(c, "status must be one of: approved, rejected, pending");
    }
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return badRequest(c, "Invalid comment id");
    await c.env.DB.prepare(`UPDATE comments SET status = ? WHERE id = ?`).bind(status, id).run();
    return c.json({ ok: true });
  });

  app.delete("/admin/comments/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return badRequest(c, "Invalid comment id");
    // Replies cascade via the self-referencing FK.
    await c.env.DB.prepare(`DELETE FROM comments WHERE id = ? OR parent_id = ?`).bind(id, id).run();
    return c.json({ ok: true });
  });

  // ── Subscribers ────────────────────────────────────────────────────────────
  app.get("/admin/subscribers", async (c) => {
    const status = c.req.query("status");
    const where = status && ["pending", "confirmed", "unsubscribed"].includes(status) ? `WHERE status = ?` : "";
    const params = where ? [status] : [];
    const rows = (
      await c.env.DB.prepare(`SELECT * FROM subscribers ${where} ORDER BY created_at DESC LIMIT 500`).bind(...params).all()
    ).results as unknown as {
      id: number;
      email: string;
      name: string | null;
      status: string;
      source: string | null;
      created_at: string;
      confirmed_at: string | null;
    }[];
    const items: Subscriber[] = rows.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status as Subscriber["status"],
      source: r.source,
      createdAt: r.created_at,
      confirmedAt: r.confirmed_at,
    }));
    return c.json({
      items,
      totals: {
        pending: items.filter((i) => i.status === "pending").length,
        confirmed: items.filter((i) => i.status === "confirmed").length,
        unsubscribed: items.filter((i) => i.status === "unsubscribed").length,
      },
    });
  });

  app.delete("/admin/subscribers/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return badRequest(c, "Invalid subscriber id");
    await c.env.DB.prepare(`DELETE FROM subscribers WHERE id = ?`).bind(id).run();
    return c.json({ ok: true });
  });

  // Confirmed subscribers as CSV — the export an ESP import actually wants.
  app.get("/admin/subscribers/export", async (c) => {
    const rows = (
      await c.env.DB.prepare(`SELECT email, name, status, source, confirmed_at FROM subscribers WHERE status = 'confirmed' ORDER BY confirmed_at DESC`)
        .all<{ email: string; name: string | null; status: string; source: string | null; confirmed_at: string | null }>()
    ).results;
    const esc = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const csv = ["email,name,status,source,confirmed_at", ...rows.map((r) => [esc(r.email), esc(r.name), esc(r.status), esc(r.source), esc(r.confirmed_at)].join(","))].join("\n");
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="freegameplay-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });

  // ── Scores ─────────────────────────────────────────────────────────────────
  app.get("/admin/scores", async (c) => {
    const gameSlug = c.req.query("game") ?? undefined;
    const items = await listScores(c.env.DB, { gameSlug, limit: Number(c.req.query("limit") ?? 100) || 100 });
    return c.json({ items });
  });

  app.delete("/admin/scores/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return badRequest(c, "Invalid score id");
    const row = (await c.env.DB.prepare(`SELECT game_slug FROM scores WHERE id = ?`).bind(id).first<{ game_slug: string }>()) ?? null;
    await c.env.DB.prepare(`DELETE FROM scores WHERE id = ?`).bind(id).run();
    if (row) await c.env.CACHE.delete(`board:${row.game_slug}`);
    return c.json({ ok: true });
  });

  return app;
}
