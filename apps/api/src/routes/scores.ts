// Leaderboards for the built-in canvas engines.
//
//   GET  /api/games/:slug/leaderboard      → top scores + the caller's best
//   POST /api/games/:slug/scores           → submit a finished run
//
// The board shows one row per player (their best score), so a spam run can
// push a name down but cannot flood the top of the list. Submissions are
// rate-limited per IP+day and sanity-checked against elapsed play time.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { kvGetJson, kvSetJson } from "../lib/cache";
import { one } from "../lib/db";
import { visitorHash } from "../lib/identity";
import { rateLimit } from "../lib/rate";
import { badRequest, notFound } from "../lib/respond";
import { cleanText, LIMITS, scoreIsPlausible, slugish } from "../lib/validate";
import type { LeaderboardPayload, ScoreEntry, SubmitScorePayload } from "@fg/shared";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

const BOARD_LIMIT = 10;
const SUBMISSIONS_PER_DAY = 30;

export function scoresApp() {
  const app = new Hono<Env>();

  // ── Read the board ─────────────────────────────────────────────────────────
  app.get("/games/:slug/leaderboard", async (c) => {
    const slug = slugish(c.req.param("slug"));
    if (!slug) return notFound(c, "Unknown game");
    const db = c.env.DB;

    const game = await one<{ id: number; title: string; builtin: string | null; leaderboard_enabled: number }>(
      db.prepare(`SELECT id, title, builtin, leaderboard_enabled FROM games WHERE slug = ?`).bind(slug),
    );
    if (!game) return notFound(c, `Game "${slug}" not found`);
    if (!game.leaderboard_enabled) {
      return c.json<LeaderboardPayload>({
        gameSlug: slug,
        gameTitle: game.title,
        engine: null,
        entries: [],
        total: 0,
        myBest: null,
        myRank: null,
      });
    }

    const cacheKey = `board:${slug}`;
    const cached = await kvGetJson<Omit<LeaderboardPayload, "myBest" | "myRank">>(c.env.CACHE, cacheKey);
    const base =
      cached ??
      (await (async () => {
        const rows = (
          await db
            .prepare(
              `SELECT s.player_name, MAX(s.score) AS best, s.detail, MAX(s.created_at) AS at
                 FROM scores s WHERE s.game_slug = ?
                 GROUP BY s.player_name
                 ORDER BY best DESC, at ASC
                 LIMIT ?`,
            )
            .bind(slug, BOARD_LIMIT + 1)
            .all<{ player_name: string; best: number; detail: string | null; at: string }>()
        ).results;
        const total = ((await db.prepare(`SELECT COUNT(DISTINCT player_name) AS n FROM scores WHERE game_slug = ?`).bind(slug).first()) as { n: number } | null)?.n ?? 0;
        const payload: Omit<LeaderboardPayload, "myBest" | "myRank"> = {
          gameSlug: slug,
          gameTitle: game.title,
          engine: game.builtin ? safeEngine(game.builtin) : null,
          total,
          entries: rows.slice(0, BOARD_LIMIT).map((r, i) => ({
            id: i + 1,
            gameSlug: slug,
            playerName: r.player_name,
            score: r.best,
            detail: r.detail,
            createdAt: r.at,
          })),
        };
        await kvSetJson(c.env.CACHE, cacheKey, payload, 60);
        return payload;
      })());

    // The caller's own best is per-visitor and must never be cached publicly.
    const hash = await visitorHash(c, c.env.ANALYTICS_SALT);
    const mine = await one<{ best: number; rank: number }>(
      db
        .prepare(
          `SELECT MAX(score) AS best,
                  (SELECT COUNT(*) FROM (SELECT MAX(score) AS s FROM scores WHERE game_slug = ? GROUP BY player_name) WHERE s > MAX(score)) + 1 AS rank
             FROM scores WHERE game_slug = ? AND client_hash = ?`,
        )
        .bind(slug, slug, hash),
    );

    const myBest = mine?.best ?? null;
    return c.json<LeaderboardPayload>({
      ...base,
      myBest: myBest === null ? null : Number(myBest),
      myRank: myBest === null ? null : Number(mine?.rank ?? 0) || null,
    });
  });

  // ── Submit a score ─────────────────────────────────────────────────────────
  app.post("/games/:slug/scores", async (c) => {
    const slug = slugish(c.req.param("slug"));
    if (!slug) return notFound(c, "Unknown game");

    const limited = await rateLimit(c, c.env.CACHE, "score", 20, 3600);
    if (limited) return limited;

    const db = c.env.DB;
    const game = await one<{ id: number; title: string; leaderboard_enabled: number; builtin: string | null }>(
      db.prepare(`SELECT id, title, leaderboard_enabled, builtin FROM games WHERE slug = ?`).bind(slug),
    );
    if (!game) return notFound(c, `Game "${slug}" not found`);
    if (!game.leaderboard_enabled) {
      return badRequest(c, "This game does not keep a public leaderboard.");
    }

    const body = (await c.req.json().catch(() => null)) as SubmitScorePayload | null;
    if (!body) return badRequest(c, "JSON body required");

    const score = Number(body.score);
    if (!Number.isFinite(score)) return badRequest(c, "score must be a number");
    if (!Number.isInteger(score)) return badRequest(c, "score must be a whole number");
    if (score < LIMITS.score.min || score > LIMITS.score.max) return badRequest(c, "score is out of range");

    const elapsedMs = body.elapsedMs === undefined ? undefined : Number(body.elapsedMs);
    if (!scoreIsPlausible(score, elapsedMs)) {
      return c.json({ ok: false, error: "implausible_score", message: "That score doesn't look like a real run." }, 422);
    }
    if (score <= 0) {
      return c.json({ ok: true, accepted: false, message: "Zero scores aren't recorded." });
    }

    const playerName = cleanText(body.playerName, LIMITS.name.max) || "ANON";
    const detail = cleanText(body.detail, 60);
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;
    const hash = await visitorHash(c, c.env.ANALYTICS_SALT);
    const today = new Date().toISOString().slice(0, 10);

    // De-duplicate the same session submitting the same score repeatedly.
    if (sessionId) {
      const dupe = await one<{ id: number }>(
        db.prepare(`SELECT id FROM scores WHERE game_slug = ? AND session_id = ? AND score = ? LIMIT 1`).bind(slug, sessionId, score),
      );
      if (dupe) return c.json({ ok: true, accepted: false, duplicate: true, message: "Already recorded." });
    }

    // Daily submission budget (distinct from the IP rate limit above, which is
    // per-hour) — a single visitor can't write more than this in a day.
    const usedToday = ((await db
      .prepare(`SELECT COUNT(*) AS n FROM scores WHERE client_hash = ? AND created_at >= ?`)
      .bind(hash, today)
      .first()) as { n: number } | null)?.n ?? 0;
    if (usedToday >= SUBMISSIONS_PER_DAY) {
      return c.json({ error: "rate_limited", message: "Daily score submission limit reached." }, 429, { "Retry-After": "3600" });
    }

    await db
      .prepare(
        `INSERT INTO scores (game_id, game_slug, player_name, score, detail, elapsed_ms, session_id, client_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(game.id, slug, playerName, score, detail || null, elapsedMs ?? null, sessionId, hash)
      .run();

    await c.env.CACHE.delete(`board:${slug}`);

    // Fresh view of where this run landed.
    const rank = ((await db
      .prepare(
        `SELECT COUNT(*) + 1 AS rank FROM (SELECT MAX(score) AS s FROM scores WHERE game_slug = ? GROUP BY player_name) WHERE s > ?`,
      )
      .bind(slug, score)
      .first()) as { rank: number } | null)?.rank ?? null;

    return c.json({ ok: true, accepted: true, score, rank, playerName }, 201);
  });

  return app;
}

function safeEngine(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { engine?: string };
    return parsed.engine ?? null;
  } catch {
    return null;
  }
}

/** Exposed for the admin surface: raw score rows for moderation. */
export async function listScores(
  db: Bindings["DB"],
  opts: { gameSlug?: string; limit?: number } = {},
): Promise<(ScoreEntry & { clientHash: string; elapsedMs: number | null; sessionId: string | null })[]> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 100));
  const where = opts.gameSlug ? `WHERE game_slug = ?` : "";
  const params = opts.gameSlug ? [opts.gameSlug, limit] : [limit];
  const rows = (
    await db
      .prepare(`SELECT id, game_slug, player_name, score, detail, created_at, client_hash, elapsed_ms, session_id FROM scores ${where} ORDER BY id DESC LIMIT ?`)
      .bind(...(params as (string | number)[]))
      .all<{
        id: number;
        game_slug: string;
        player_name: string;
        score: number;
        detail: string | null;
        created_at: string;
        client_hash: string;
        elapsed_ms: number | null;
        session_id: string | null;
      }>()
  ).results;
  return rows.map((r) => ({
    id: r.id,
    gameSlug: r.game_slug,
    playerName: r.player_name,
    score: r.score,
    detail: r.detail,
    createdAt: r.created_at,
    clientHash: r.client_hash.slice(0, 12),
    elapsedMs: r.elapsed_ms,
    sessionId: r.session_id,
  }));
}
