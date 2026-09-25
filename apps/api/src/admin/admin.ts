// Admin surface — token-gated. Migration control center, contact inbox,
// health checks, backups/export, and the import endpoint itself.

import { Hono, type Context } from "hono";
import { detectFeedKind, parseBloggerXml, parseFeedXml, type ContactPayload, type ImportRecords, type MigrationItem, type MigrationReport, type MigrationRun } from "@fg/shared";
import { badRequest, unauthorized } from "../lib/respond";
import { rateLimit } from "../lib/rate";
import { rollbackJob, runImport } from "./import";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

function assertAdmin(c: Context): Response | null {
  const token = c.req.header("authorization")?.replace(/^Bearer\s+/i, "") ?? c.req.header("x-admin-token") ?? "";
  const expected = c.env.ADMIN_TOKEN;
  if (!expected || token !== expected) return unauthorized(c, "Invalid or missing admin token");
  return null;
}

interface ParsedImport {
  records: ImportRecords;
  label: string;
  kind?: "blogger" | "rss";
  parse?: { totals: { entries: number; posts: number; pages: number; comments: number; labels: number; images: number }; diagnostics: { level: string; code: string; message: string; entry?: number }[]; comments: unknown[]; feedTitle?: string | null; hasExcerptsOnly?: boolean };
}

/** Parse raw feed/export XML, auto-detecting Blogger Atom vs RSS 2.0 vs Atom. */
function parseImportXml(raw: string): { ok: true; value: ParsedImport } | { ok: false; error: string } {
  const kind = detectFeedKind(raw);
  if (kind === "blogger") {
    const parsed = parseBloggerXml(raw);
    const err = parsed.diagnostics.find((d) => d.level === "error");
    if (err) return { ok: false, error: "Blogger XML could not be parsed: " + err.message };
    return {
      ok: true,
      value: {
        records: parsed.records,
        label: `blogger-export-${new Date().toISOString().slice(0, 10)}`,
        kind: "blogger",
        parse: { totals: parsed.totals, diagnostics: parsed.diagnostics, comments: parsed.comments },
      },
    };
  }
  if (kind === "rss" || kind === "atom") {
    const parsed = parseFeedXml(raw);
    if (!parsed) return { ok: false, error: "Feed XML could not be parsed." };
    const slug = (parsed.feedTitle ?? "import").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    return {
      ok: true,
      value: {
        records: parsed.records,
        label: `feed-${slug || "import"}-${new Date().toISOString().slice(0, 10)}`,
        kind: "rss",
        parse: { totals: parsed.totals, diagnostics: parsed.diagnostics, comments: parsed.comments, feedTitle: parsed.feedTitle, hasExcerptsOnly: parsed.hasExcerptsOnly },
      },
    };
  }
  return { ok: false, error: "Unrecognized XML: expected a Blogger export, RSS 2.0 or Atom feed." };
}

/** SSRF guard: only public http(s) hosts, no local/private ranges. */
function assertSafeFeedUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("invalid feed URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("only http(s) feed URLs are allowed");
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".localhost") || h.endsWith(".internal")) throw new Error("local hostnames are not allowed");
  const bare = h.replace(/^\[|\]$/g, "");
  if (bare.includes(":")) {
    if (bare === "::1" || bare === "::" || bare.startsWith("fe80") || bare.startsWith("fc") || bare.startsWith("fd")) throw new Error("private address not allowed");
  } else {
    if (h === "0.0.0.0") throw new Error("private address not allowed");
    const m = h.match(/^(\d+)\.(\d+)\./);
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      if (a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
        throw new Error("private address not allowed");
      }
    }
  }
  return u;
}

async function importRecordsFromBody(c: Context, raw: string): Promise<ParsedImport | Response> {
  // Accept: JSON { records } | { xml } | { url } | raw Blogger XML | raw RSS/Atom XML.
  const looksXml = raw.trimStart().startsWith("<");
  if (looksXml) {
    const outcome = parseImportXml(raw);
    if (!outcome.ok) return badRequest(c, outcome.error);
    return outcome.value;
  }
  try {
    const json = JSON.parse(raw) as { records?: ImportRecords; xml?: string; url?: string; sourceLabel?: string } & ImportRecords;
    if (json.url) {
      let feedUrl: URL;
      try {
        feedUrl = assertSafeFeedUrl(json.url);
      } catch (e) {
        return badRequest(c, `Feed URL rejected: ${(e as Error).message}`);
      }
      let feedXml: string;
      try {
        const res = await fetch(feedUrl, { redirect: "follow", signal: AbortSignal.timeout(15000) });
        if (!res.ok) return badRequest(c, `Feed fetch failed: HTTP ${res.status} from ${feedUrl.host}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength > 8 * 1024 * 1024) return badRequest(c, "Feed too large (max 8 MB).");
        feedXml = new TextDecoder("utf-8").decode(buf);
      } catch (e) {
        return badRequest(c, `Feed fetch failed: ${(e as Error).message}`);
      }
      const outcome = parseImportXml(feedXml);
      if (!outcome.ok) return badRequest(c, outcome.error);
      return { ...outcome.value, label: json.sourceLabel ?? outcome.value.label };
    }
    if (json.xml) {
      const outcome = parseImportXml(json.xml);
      if (!outcome.ok) return badRequest(c, outcome.error);
      return { ...outcome.value, label: json.sourceLabel ?? outcome.value.label };
    }
    const records = (json.records ?? json) as ImportRecords;
    if (!records || typeof records !== "object" || !Array.isArray(records.posts) || !Array.isArray(records.games)) {
      return badRequest(c, "Body must be { records } with at least posts[] and games[], { xml }, { url }, or raw feed/export XML.");
    }
    return { records, label: json.sourceLabel ?? "json-push" };
  } catch {
    return badRequest(c, "Body is neither valid JSON nor XML.");
  }
}

export function adminApp() {
  const app = new Hono<Env>();

  app.use("/admin/*", async (c, next) => {
    const denied = assertAdmin(c);
    if (denied) return denied;
    await next();
  });

  // ── Import (Blogger XML or JSON) ───────────────────────────────────────────
  app.post("/admin/import", async (c) => {
    const raw = await c.req.text();
    if (!raw || raw.length > 15_000_000) return badRequest(c, "Body required (max 15 MB).");
    const header = (await c.req.header("x-dry-run") === "1") || (c.req.header("x-dry-run") === "true");
    let label: string | undefined;
    let downloadMedia = false;
    let kind: "blogger" | "seed" | "manual" = "blogger";
    try {
      const meta = JSON.parse(c.req.header("x-import-meta") ?? "{}") as { sourceLabel?: string; downloadMedia?: boolean; kind?: string };
      label = meta.sourceLabel;
      downloadMedia = Boolean(meta.downloadMedia);
      if (meta.kind === "seed" || meta.kind === "manual") kind = meta.kind;
    } catch {
      /* meta is optional */
    }

    const resolved = await importRecordsFromBody(c, raw);
    if (resolved instanceof Response) return resolved;

    const outcome = await runImport(c.env, resolved.records, { dryRun: header, sourceLabel: label, downloadMedia }, kind);
    return c.json({
      ok: true,
      dryRun: header,
      run: outcome.run,
      stats: outcome.stats,
      warnings: outcome.warnings,
      parse: resolved.parse,
      note: header ? "Dry-run completed: nothing was written." : undefined,
    });
  });

  // ── Migration report ───────────────────────────────────────────────────────
  app.get("/admin/report", async (c) => {
    const db = c.env.DB;
    const runs = (await db.prepare(`SELECT * FROM migration_runs ORDER BY started_at DESC LIMIT 20`).all()).results as (Omit<MigrationRun, "stats"> & { stats: string })[];
    const parsedRuns: MigrationRun[] = runs.map((r) => ({ ...r, stats: r.stats ? JSON.parse(r.stats) : null }));

    const runFilter = c.req.query("runId");
    const itemsWhere = runFilter ? `WHERE run_id = ?` : `WHERE run_id IN (SELECT id FROM migration_runs ORDER BY started_at DESC LIMIT 5)`;
    const itemsParams = runFilter ? [Number(runFilter)] : [];
    const items = ((await db.prepare(`SELECT * FROM migration_items ${itemsWhere} ORDER BY id DESC LIMIT 500`).bind(...itemsParams).all()) as unknown as { results: MigrationItem[] }).results;
    const byStatus = ((await db.prepare(`SELECT status, COUNT(*) AS n FROM migration_items ${itemsWhere} GROUP BY status`).bind(...itemsParams).all()) as unknown as { results: { status: string; n: number }[] }).results;

    const unresolved = ((await db.prepare(`SELECT url, used_by, notes FROM media WHERE status = 'unresolved' ORDER BY id DESC LIMIT 200`).all()) as unknown as { results: { url: string; used_by: string | null; notes: string | null }[] }).results;
    const unverified = ((await db.prepare(`SELECT from_url, to_url FROM redirects WHERE verified = 0 ORDER BY id DESC LIMIT 200`).all()) as unknown as { results: { from_url: string; to_url: string }[] }).results;

    const report: MigrationReport = {
      runs: parsedRuns,
      itemsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
      recentItems: items,
      unresolvedMedia: unresolved.map((m) => ({ url: m.url, usedBy: m.used_by ? JSON.parse(m.used_by) as string[] : [], notes: m.notes })),
      unverifiedRedirects: unverified.map((r) => ({ fromUrl: r.from_url, toUrl: r.to_url })),
    };
    return c.json(report);
  });

  // ── Rollback a job ─────────────────────────────────────────────────────────
  app.post("/admin/rollback/:jobId", async (c) => {
    const result = await rollbackJob(c.env, c.req.param("jobId"));
    return c.json(result);
  });

  // ── Contact inbox ──────────────────────────────────────────────────────────
  app.get("/admin/messages", async (c) => {
    const rows = ((await c.env.DB.prepare(`SELECT * FROM messages ORDER BY created_at DESC LIMIT 200`).all()) as unknown as {
      results: { id: number; name: string; email: string; subject: string | null; body: string; status: string; created_at: string }[];
    }).results;
    return c.json({
      items: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, subject: r.subject, body: r.body, status: r.status as "new" | "read" | "archived", createdAt: r.created_at })),
    });
  });

  app.post("/admin/messages/:id/status", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { status?: string } | null;
    const status = body?.status;
    if (!status || !["new", "read", "archived"].includes(status)) return badRequest(c, "status must be one of: new, read, archived");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return badRequest(c, "Invalid message id");
    await c.env.DB.prepare(`UPDATE messages SET status = ? WHERE id = ?`).bind(status, id).run();
    return c.json({ ok: true });
  });

  // ── Health (admin-grade) ───────────────────────────────────────────────────
  app.get("/admin/health", async (c) => {
    const db = c.env.DB;
    let dbOk = false;
    let r2Ok = false;
    let kvOk = false;
    try {
      await db.prepare(`SELECT 1`).first();
      dbOk = true;
    } catch {
      dbOk = false;
    }
    try {
      await c.env.MEDIA.list({ limit: 1 });
      r2Ok = true;
    } catch {
      r2Ok = false;
    }
    try {
      await c.env.CACHE.put("health:probe", "1", { expirationTtl: 60 });
      kvOk = (await c.env.CACHE.get("health:probe")) === "1";
    } catch {
      kvOk = false;
    }
    const counts = dbOk
      ? (
          await db.prepare(
            `SELECT (SELECT COUNT(*) FROM games) AS games, (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM guides) AS guides, (SELECT COUNT(*) FROM redirects) AS redirects`,
          ).first()
        ) as { games: number; posts: number; guides: number; redirects: number }
      : null;
    return c.json(
      { ok: dbOk && r2Ok && kvOk, version: c.env.APP_VERSION, checks: { db: dbOk, r2: r2Ok, kv: kvOk }, counts: counts ?? { games: 0, posts: 0, guides: 0, redirects: 0 } },
      dbOk ? 200 : 503,
    );
  });

  // ── Export (backup) ────────────────────────────────────────────────────────
  app.get("/admin/export", async (c) => {
    const db = c.env.DB;
    const tables = ["site_settings", "categories", "tags", "authors", "games", "posts", "guides", "pages", "post_tags", "game_tags", "guide_tags", "redirects", "media", "messages", "migration_runs"] as const;
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), version: c.env.APP_VERSION };
    for (const t of tables) {
      out[t] = ((await db.prepare(`SELECT * FROM ${t}`).all()) as unknown as { results: unknown[] }).results;
    }
    return c.json(out);
  });

  // ── Redirect verification mark ─────────────────────────────────────────────
  app.post("/admin/redirects/:id/verify", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return badRequest(c, "Invalid redirect id");
    await c.env.DB.prepare(`UPDATE redirects SET verified = 1 WHERE id = ?`).bind(id).run();
    return c.json({ ok: true });
  });

  return app;
}

// Public contact endpoint lives here too (rate-limited, token-free).
export function contactApp() {
  const app = new Hono<Env>();

  app.post("/contact", async (c) => {
    const limited = await rateLimit(c, c.env.CACHE, "contact", 5, 3600);
    if (limited) return limited;

    const body = (await c.req.json().catch(() => null)) as ContactPayload | null;
    if (!body) return badRequest(c, "JSON body required");
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim();
    const subject = (body.subject ?? "").trim().slice(0, 200) || null;
    const msg = (body.body ?? "").trim();
    if (name.length < 2 || name.length > 120) return badRequest(c, "name must be 2–120 characters");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return badRequest(c, "a valid email is required");
    if (msg.length < 10 || msg.length > 6000) return badRequest(c, "message must be 10–6000 characters");

    await c.env.DB.prepare(`INSERT INTO messages (name, email, subject, body) VALUES (?, ?, ?, ?)`).bind(name, email, subject, msg).run();
    return c.json({ ok: true, message: "Thanks — your message is in. We read everything." }, 201);
  });

  return app;
}
