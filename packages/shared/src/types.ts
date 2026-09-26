// ─────────────────────────────────────────────────────────────────────────────
// @fg/shared — canonical content model.
// The exact shape both the Cloudflare backend (D1 rows) and the Next.js
// frontend (API client) agree on. No drift: everything is typed here.
// ─────────────────────────────────────────────────────────────────────────────

export type SourceKind = "seed" | "blogger" | "manual";

export type PlayableType = "builtin" | "external" | "none";

export interface BuiltinGameConfig {
  /** One of: breakout | dodge | snake | gravity */
  engine: "breakout" | "dodge" | "snake" | "gravity";
  /** Optional palette accent override (hex). */
  accent?: string;
  /** Optional difficulty seed (1–3). */
  difficulty?: 1 | 2 | 3;
  name: string;
}

export interface Game {
  id: number;
  slug: string;
  title: string;
  tagline: string | null;
  description: string; // HTML
  coverUrl: string | null; // site-absolute or same-origin media path
  thumbnails: { url: string; alt: string }[];
  genre: string | null;
  categoryId: number | null;
  categoryName: string | null;
  platform: string;
  playableType: PlayableType;
  playableRef: string | null; // builtin engine id or external URL
  builtin: BuiltinGameConfig | null;
  controls: string | null; // HTML
  contentRating: string;
  featured: boolean;
  trending: boolean;
  /** Public leaderboard is open for this game (built-in engines only). */
  leaderboardEnabled: boolean;
  source: SourceKind;
  sourceId: string | null;
  legacyUrl: string | null;
  publishedAt: string | null; // ISO
  updatedAt: string | null; // ISO
  seoTitle: string | null;
  seoDescription: string | null;
  tags: Tag[];
}

export interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml?: string; // omitted on list payloads
  featuredImageUrl: string | null;
  authorId: number | null;
  authorName: string | null;
  authorSlug: string | null;
  categoryId: number | null;
  categoryName: string | null;
  featured: boolean;
  source: SourceKind;
  sourceId: string | null;
  legacyUrl: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  readingMinutes: number;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: Tag[];
}

export interface Guide {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  contentHtml?: string;
  featuredImageUrl: string | null;
  gameId: number | null;
  gameTitle: string | null;
  gameSlug: string | null;
  authorId: number | null;
  authorName: string | null;
  authorSlug: string | null;
  categoryId: number | null;
  categoryName: string | null;
  source: SourceKind;
  sourceId: string | null;
  legacyUrl: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  readingMinutes: number;
  tags: Tag[];
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface Tag {
  id: number;
  slug: string;
  name: string;
}

export interface Author {
  id: number;
  name: string;
  slug: string;
  bio: string | null;
  avatarUrl: string | null;
}

export interface Page {
  id: number;
  slug: string;
  title: string;
  contentHtml: string;
  publishedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface SiteSettings {
  id: number;
  name: string;
  tagline: string | null;
  description: string | null;
}

export interface SiteStats {
  games: number;
  posts: number;
  guides: number;
  categories: number;
  playableNow: number;
}

// ── List payloads ─────────────────────────────────────────────────────────────

export interface HomePayload {
  site: SiteSettings;
  stats: SiteStats;
  featuredGames: Game[];
  latestGames: Game[];
  latestPosts: Post[];
  latestGuides: Guide[];
  categories: Category[];
  tags: Tag[];
}

export type GameSort = "featured" | "newest" | "oldest" | "title";

export interface GamesQuery {
  genre?: string;
  q?: string;
  sort?: GameSort;
  page?: number;
  pageSize?: number;
}

export interface GamesListPayload {
  items: Game[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  genres: string[];
}

export interface PostsQuery {
  category?: string;
  tag?: string;
  author?: string;
  page?: number;
  pageSize?: number;
}

export interface PostsListPayload {
  items: Post[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface DetailPayload<T> {
  item: T;
  related: (Game | Post | Guide)[];
}

export interface CategoryDetailPayload {
  category: Category;
  posts: Post[];
  games: Game[];
  guides: Guide[];
}

// ── Search ────────────────────────────────────────────────────────────────────

export type SearchType = "games" | "posts" | "guides";

export interface SearchHit {
  type: SearchType;
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  url: string;
  score: number;
  publishedAt: string | null;
}

export interface SearchPayload {
  q: string;
  hits: SearchHit[];
  tookMs: number;
}

// ── Migration pipeline ────────────────────────────────────────────────────────

export interface ImportRecords {
  site?: Partial<Omit<SiteSettings, "id">>;
  categories: { slug: string; name: string; description?: string; sortOrder?: number }[];
  tags: { slug: string; name: string }[];
  authors: { slug: string; name: string; bio?: string; avatarUrl?: string }[];
  games: ImportGame[];
  posts: ImportPost[];
  guides: ImportGuide[];
  pages: ImportPage[];
  media?: ImportMedia[];
}

export interface ImportGame {
  slug: string;
  title: string;
  tagline?: string;
  description?: string;
  coverUrl?: string;
  thumbnails?: { url: string; alt: string }[];
  genre?: string;
  category?: string;
  platform?: string;
  playableType?: PlayableType;
  playableRef?: string;
  builtin?: BuiltinGameConfig;
  /** Keep a public leaderboard for this game. Defaults on for builtin engines. */
  leaderboard?: boolean;
  controls?: string;
  contentRating?: string;
  featured?: boolean;
  trending?: boolean;
  tags?: string[]; // slugs
  sourceId?: string;
  legacyUrl?: string;
  publishedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ImportPost {
  slug: string;
  title: string;
  excerpt?: string;
  contentHtml?: string;
  featuredImageUrl?: string;
  author?: string; // slug
  category?: string; // slug
  featured?: boolean;
  tags?: string[];
  sourceId?: string;
  legacyUrl?: string;
  publishedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ImportGuide {
  slug: string;
  title: string;
  excerpt?: string;
  contentHtml?: string;
  featuredImageUrl?: string;
  game?: string; // slug
  author?: string;
  category?: string;
  tags?: string[];
  sourceId?: string;
  legacyUrl?: string;
  publishedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ImportPage {
  slug: string;
  title: string;
  contentHtml?: string;
  legacyUrl?: string;
  sourceId?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface ImportMedia {
  url: string; // original source URL
  r2Key?: string; // populated when transferred
  status?: "uploaded" | "unresolved" | "skipped";
  usedBy?: string[];
  notes?: string;
}

export interface ImportOptions {
  dryRun?: boolean;
  sourceLabel?: string; // e.g. "blogger-export-2026-09"
  downloadMedia?: boolean;
}

export interface ImportStats {
  categories: { created: number; updated: number };
  tags: { created: number; updated: number };
  authors: { created: number; updated: number };
  games: { created: number; updated: number; skipped: number; failed: number };
  posts: { created: number; updated: number; skipped: number; failed: number };
  guides: { created: number; updated: number; skipped: number; failed: number };
  pages: { created: number; updated: number; skipped: number; failed: number };
  redirects: { created: number; updated: number; skipped: number };
  media: { uploaded: number; unresolved: number; skipped: number };
}

export interface MigrationRun {
  id: number;
  jobId: string;
  sourceType: "blogger" | "rss" | "seed" | "manual";
  sourceLabel: string | null;
  status: "running" | "done" | "failed" | "dry-run";
  startedAt: string;
  finishedAt: string | null;
  stats: ImportStats | null;
}

export interface MigrationItem {
  id: number;
  runId: number;
  itemType: "post" | "game" | "guide" | "page" | "redirect" | "media" | "category" | "tag" | "author";
  sourceId: string | null;
  legacyUrl: string | null;
  status: "imported" | "updated" | "skipped" | "failed";
  detail: string | null;
}

export interface MigrationReport {
  runs: MigrationRun[];
  itemsByStatus: Record<string, number>;
  recentItems: MigrationItem[];
  unresolvedMedia: { url: string; usedBy: string[]; notes: string | null }[];
  unverifiedRedirects: { fromUrl: string; toUrl: string }[];
}

// ── Contact / admin ───────────────────────────────────────────────────────────

export interface ContactPayload {
  name: string;
  email: string;
  subject?: string;
  body: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  status: "new" | "read" | "archived";
  createdAt: string;
}

export interface HealthPayload {
  ok: boolean;
  version: string;
  checks: { db: boolean; r2: boolean; kv: boolean };
  counts: { games: number; posts: number; guides: number; redirects: number };
}

// ── Leaderboards (built-in games) ────────────────────────────────────────────

export interface ScoreEntry {
  id: number;
  gameSlug: string;
  playerName: string;
  score: number;
  detail: string | null;
  createdAt: string;
  /** True when this row belongs to the browser that submitted it (session). */
  mine?: boolean;
}

export interface LeaderboardPayload {
  gameSlug: string;
  gameTitle: string;
  engine: string | null;
  entries: ScoreEntry[];
  total: number;
  /** Best score submitted from this browser session, if any. */
  myBest: number | null;
  /** Rank (1-based) of myBest, when it made the board. */
  myRank: number | null;
}

export interface SubmitScorePayload {
  playerName?: string;
  score: number;
  detail?: string;
  /** Anti-cheat: elapsed play time in ms reported by the engine. */
  elapsedMs?: number;
  /** Opaque per-session id so we can de-duplicate re-submissions. */
  sessionId?: string;
}

// ── Comments (moderated) ─────────────────────────────────────────────────────

export type CommentStatus = "pending" | "approved" | "rejected";

export interface CommentNode {
  id: number;
  parentId: number | null;
  authorName: string;
  body: string;
  createdAt: string;
  replies: CommentNode[];
}

export interface CommentsPayload {
  targetType: "post" | "guide";
  targetSlug: string;
  total: number;
  comments: CommentNode[];
}

export interface SubmitCommentPayload {
  targetType: "post" | "guide";
  targetSlug: string;
  parentId?: number | null;
  authorName: string;
  authorEmail?: string;
  body: string;
  /** Honeypot: must stay empty. */
  website?: string;
}

export interface AdminComment {
  id: number;
  targetType: string;
  targetSlug: string;
  parentId: number | null;
  authorName: string;
  authorEmail: string | null;
  body: string;
  status: CommentStatus;
  createdAt: string;
}

// ── Newsletter ───────────────────────────────────────────────────────────────

export type SubscriberStatus = "pending" | "confirmed" | "unsubscribed";

export interface Subscriber {
  id: number;
  email: string;
  status: SubscriberStatus;
  source: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface SubscribePayload {
  email: string;
  name?: string;
  source?: string;
  website?: string;
}

// ── First-party analytics (no cookies, no PII) ───────────────────────────────

export interface PageviewPayload {
  path: string;
  referrer?: string;
  /** Screen width bucket, coarse on purpose. */
  vw?: number;
}

export interface AnalyticsDay {
  day: string;
  views: number;
  visitors: number;
}

export interface AnalyticsTopPage {
  path: string;
  views: number;
  visitors: number;
}

export interface AnalyticsReport {
  days: number;
  totals: { views: number; visitors: number; pages: number };
  series: AnalyticsDay[];
  topPages: AnalyticsTopPage[];
  topReferrers: { referrer: string; views: number }[];
  devices: { bucket: string; views: number }[];
}

// ── Admin dashboard ──────────────────────────────────────────────────────────

export interface AdminOverview {
  health: { ok: boolean; checks: { db: boolean; r2: boolean; kv: boolean } };
  counts: {
    games: number;
    posts: number;
    guides: number;
    pages: number;
    redirects: number;
    messages: number;
    comments: { pending: number; approved: number; rejected: number };
    subscribers: { pending: number; confirmed: number; unsubscribed: number };
    scores: number;
    mediaUnresolved: number;
  };
  analytics: AnalyticsReport;
  recentMessages: { id: number; name: string; email: string; subject: string | null; createdAt: string; status: string }[];
}

// ── Taxonomy archives ────────────────────────────────────────────────────────

export interface AuthorSummary {
  id: number;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  postCount: number;
}

export interface AuthorDetailPayload {
  author: AuthorSummary;
  posts: Post[];
}

export interface TagSummary {
  id: number;
  slug: string;
  name: string;
  postCount: number;
}

export interface TagDetailPayload {
  tag: TagSummary;
  posts: Post[];
}
