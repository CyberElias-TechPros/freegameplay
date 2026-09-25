-- ═══════════════════════════════════════════════════════════════════════════
-- FreeGameplay content backend — initial schema (Cloudflare D1 / SQLite)
-- Idempotent: safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'FreeGameplay',
  tagline TEXT,
  description TEXT,
  social_json TEXT
);

INSERT OR IGNORE INTO site_settings (id, name, tagline, description)
VALUES (1, 'FreeGameplay', 'Free browser games, guides and writing.',
        'A hand-curated arcade of free browser games with deep guides, reviews and writing. No downloads, no paywalls, no fluff.');

-- ── Taxonomy ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  source TEXT NOT NULL DEFAULT 'seed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Content ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  tagline TEXT,
  description TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  thumbnails TEXT NOT NULL DEFAULT '[]',
  genre TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  platform TEXT NOT NULL DEFAULT 'browser',
  playable_type TEXT NOT NULL DEFAULT 'none',
  playable_ref TEXT,
  builtin TEXT,
  controls TEXT,
  content_rating TEXT NOT NULL DEFAULT 'all',
  featured INTEGER NOT NULL DEFAULT 0,
  trending INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'seed',
  source_id TEXT UNIQUE,
  legacy_url TEXT UNIQUE,
  published_at TEXT,
  updated_at TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_games_category ON games(category_id);
CREATE INDEX IF NOT EXISTS idx_games_featured ON games(featured DESC, trending DESC, published_at DESC);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  featured_image_url TEXT,
  author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  featured INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'seed',
  source_id TEXT UNIQUE,
  legacy_url TEXT UNIQUE,
  published_at TEXT,
  updated_at TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);

CREATE TABLE IF NOT EXISTS guides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_html TEXT NOT NULL DEFAULT '',
  featured_image_url TEXT,
  game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
  author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'seed',
  source_id TEXT UNIQUE,
  legacy_url TEXT UNIQUE,
  published_at TEXT,
  updated_at TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guides_game ON guides(game_id);
CREATE INDEX IF NOT EXISTS idx_guides_published ON guides(published_at DESC);

CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'seed',
  source_id TEXT UNIQUE,
  legacy_url TEXT UNIQUE,
  published_at TEXT,
  updated_at TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Junctions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag_id);

CREATE TABLE IF NOT EXISTS game_tags (
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_game_tags_tag ON game_tags(tag_id);

CREATE TABLE IF NOT EXISTS guide_tags (
  guide_id INTEGER NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (guide_id, tag_id)
);

-- ── Legacy URL registry (SEO migration) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS redirects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_url TEXT UNIQUE NOT NULL,
  to_url TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 308,
  source TEXT NOT NULL DEFAULT 'blogger',
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_redirects_to ON redirects(to_url);

-- ── Media inventory ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  r2_key TEXT,
  mime_type TEXT,
  bytes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  used_by TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);

-- ── Migration audit trail ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS migration_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT UNIQUE NOT NULL,
  source_type TEXT NOT NULL,
  source_label TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  stats TEXT
);

CREATE TABLE IF NOT EXISTS migration_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES migration_runs(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  source_id TEXT,
  legacy_url TEXT,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_run ON migration_items(run_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON migration_items(status);

-- ── Contact inbox ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Full-text search (FTS5, external-content tables) ────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  title, excerpt, content_html,
  content='posts', content_rowid='id'
);
CREATE VIRTUAL TABLE IF NOT EXISTS games_fts USING fts5(
  title, tagline, description,
  content='games', content_rowid='id'
);
CREATE VIRTUAL TABLE IF NOT EXISTS guides_fts USING fts5(
  title, excerpt, content_html,
  content='guides', content_rowid='id'
);

-- FTS sync triggers
CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, excerpt, content_html)
  VALUES (new.id, new.title, new.excerpt, new.content_html);
END;
CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, excerpt, content_html)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content_html);
END;
CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, excerpt, content_html)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content_html);
  INSERT INTO posts_fts(rowid, title, excerpt, content_html)
  VALUES (new.id, new.title, new.excerpt, new.content_html);
END;

CREATE TRIGGER IF NOT EXISTS games_ai AFTER INSERT ON games BEGIN
  INSERT INTO games_fts(rowid, title, tagline, description)
  VALUES (new.id, new.title, new.tagline, new.description);
END;
CREATE TRIGGER IF NOT EXISTS games_ad AFTER DELETE ON games BEGIN
  INSERT INTO games_fts(games_fts, rowid, title, tagline, description)
  VALUES ('delete', old.id, old.title, old.tagline, old.description);
END;
CREATE TRIGGER IF NOT EXISTS games_au AFTER UPDATE ON games BEGIN
  INSERT INTO games_fts(games_fts, rowid, title, tagline, description)
  VALUES ('delete', old.id, old.title, old.tagline, old.description);
  INSERT INTO games_fts(rowid, title, tagline, description)
  VALUES (new.id, new.title, new.tagline, new.description);
END;

CREATE TRIGGER IF NOT EXISTS guides_ai AFTER INSERT ON guides BEGIN
  INSERT INTO guides_fts(rowid, title, excerpt, content_html)
  VALUES (new.id, new.title, new.excerpt, new.content_html);
END;
CREATE TRIGGER IF NOT EXISTS guides_ad AFTER DELETE ON guides BEGIN
  INSERT INTO guides_fts(guides_fts, rowid, title, excerpt, content_html)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content_html);
END;
CREATE TRIGGER IF NOT EXISTS guides_au AFTER UPDATE ON guides BEGIN
  INSERT INTO guides_fts(guides_fts, rowid, title, excerpt, content_html)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content_html);
  INSERT INTO guides_fts(rowid, title, excerpt, content_html)
  VALUES (new.id, new.title, new.excerpt, new.content_html);
END;
