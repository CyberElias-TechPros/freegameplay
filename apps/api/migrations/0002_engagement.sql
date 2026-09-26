-- ═══════════════════════════════════════════════════════════════════════════
-- FreeGameplay — engagement schema (leaderboards, comments, newsletter,
-- first-party analytics).
--
-- Idempotent: safe to re-apply. Applied after 0001_init.sql.
-- Every table that accepts untrusted input stores a hashed client identity
-- (never a raw IP) so rate-limiting and abuse review work without keeping
-- personal data.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Leaderboards ────────────────────────────────────────────────────────────
-- Scores for the built-in canvas engines. One row per submission; the board
-- is a MAX() per player_name so spam can't flood the top-10.
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_slug TEXT NOT NULL,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  detail TEXT,
  elapsed_ms INTEGER,
  session_id TEXT,
  client_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game_slug, score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_client ON scores(client_hash, created_at DESC);

-- ── Comments (moderated) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'guide')),
  target_slug TEXT NOT NULL,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  client_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_slug, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- ── Newsletter ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  source TEXT,
  confirm_token TEXT UNIQUE,
  unsubscribe_token TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  unsubscribed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status, created_at DESC);

-- ── First-party analytics ───────────────────────────────────────────────────
-- Deliberately minimal: no cookies, no IP, no user agent string. The visitor
-- id is a daily rotating hash of (ip + salt) so repeat visits within a day
-- count once, and nothing is joinable across days.
CREATE TABLE IF NOT EXISTS pageviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer_host TEXT,
  device_bucket TEXT,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pageviews_day ON pageviews(day, path);
CREATE INDEX IF NOT EXISTS idx_pageviews_created ON pageviews(created_at);
CREATE INDEX IF NOT EXISTS idx_pageviews_visitor ON pageviews(day, visitor_hash);

-- ── Taxonomy extras ─────────────────────────────────────────────────────────
-- Authors get a real archive page; give them a display name + link target.
ALTER TABLE authors ADD COLUMN website_url TEXT;

-- Games carry a short "how to play" line for the leaderboard panel.
ALTER TABLE games ADD COLUMN leaderboard_enabled INTEGER NOT NULL DEFAULT 0;
