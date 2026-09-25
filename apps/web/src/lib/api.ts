// Typed client for the FreeGameplay content API.
// Server components fetch through API_BASE directly; the browser only ever
// sees same-origin paths (Next rewrites /api/* and /media/* to the backend).

import type {
  AuthorDetailPayload,
  AuthorSummary,
  Category,
  CategoryDetailPayload,
  DetailPayload,
  Game,
  GamesListPayload,
  Guide,
  HomePayload,
  LeaderboardPayload,
  Page,
  Post,
  PostsListPayload,
  SearchHit,
  SearchPayload,
  SubmitScorePayload,
  Tag,
  TagDetailPayload,
} from "@fg/shared";

export function apiBase(): string {
  return (process.env.API_BASE ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function get<T>(path: string, revalidate = 60): Promise<T> {
  const base = apiBase();
  const res = await fetch(`${base}${path}`, { next: { revalidate } });
  if (!res.ok) throw new ApiError(res.status, `GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

function query(params: Record<string, string | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

// ── Queries (server-side) ────────────────────────────────────────────────────

export const q = {
  home: (revalidate = 60) => get<HomePayload>("/api/content/home", revalidate),
  games: (params: Record<string, string | undefined> = {}, revalidate = 60) =>
    get<GamesListPayload>(`/api/content/games${query(params)}`, revalidate),
  game: (slug: string) => get<DetailPayload<Game>>(`/api/content/games/${encodeURIComponent(slug)}`, 300),
  posts: (params: Record<string, string | undefined> = {}, revalidate = 60) =>
    get<PostsListPayload>(`/api/content/posts${query(params)}`, revalidate),
  post: (slug: string) => get<DetailPayload<Post>>(`/api/content/posts/${encodeURIComponent(slug)}`, 300),
  guides: (params: Record<string, string | undefined> = {}, revalidate = 60) =>
    get<{ items: Guide[]; total: number; page: number; pageSize: number; pages: number }>(
      `/api/content/guides${query(params)}`,
      revalidate,
    ),
  guide: (slug: string) => get<DetailPayload<Guide>>(`/api/content/guides/${encodeURIComponent(slug)}`, 300),
  categories: () => get<{ items: Category[] }>("/api/content/categories", 300),
  category: (slug: string) => get<CategoryDetailPayload>(`/api/content/categories/${encodeURIComponent(slug)}`, 120),
  tags: () => get<{ items: (Tag & { postCount: number })[] }>("/api/content/tags", 300),
  tag: (slug: string) => get<TagDetailPayload>(`/api/content/tags/${encodeURIComponent(slug)}`, 120),
  authors: () => get<{ items: AuthorSummary[] }>("/api/content/authors", 300),
  author: (slug: string) => get<AuthorDetailPayload>(`/api/content/authors/${encodeURIComponent(slug)}`, 120),
  page: (slug: string) => get<{ item: Page }>(`/api/content/pages/${encodeURIComponent(slug)}`, 3600),
  leaderboard: (slug: string) => get<LeaderboardPayload>(`/api/games/${encodeURIComponent(slug)}/leaderboard`, 30),
};

// ── Search (client-side, same-origin) ────────────────────────────────────────

export async function clientSearch(queryText: string, types?: string): Promise<SearchPayload> {
  const params = new URLSearchParams({ q: queryText });
  if (types) params.set("type", types);
  const res = await fetch(`/api/search?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, `search → ${res.status}`);
  return (await res.json()) as SearchPayload;
}

// ── Contact (client-side, same-origin) ───────────────────────────────────────

export async function clientContact(payload: { name: string; email: string; subject?: string; body: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) return { ok: false, error: json.message ?? `request failed (${res.status})` };
  return { ok: true, message: json.message };
}

// ── Leaderboard (client-side, same-origin) ───────────────────────────────────

export async function clientLeaderboard(slug: string): Promise<LeaderboardPayload> {
  const res = await fetch(`/api/games/${encodeURIComponent(slug)}/leaderboard`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, `leaderboard → ${res.status}`);
  return (await res.json()) as LeaderboardPayload;
}

export async function clientSubmitScore(
  slug: string,
  payload: SubmitScorePayload,
): Promise<{ ok: boolean; accepted?: boolean; rank?: number | null; message?: string; error?: string }> {
  const res = await fetch(`/api/games/${encodeURIComponent(slug)}/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; accepted?: boolean; rank?: number | null; message?: string; error?: string };
  if (!res.ok) return { ok: false, error: json.message ?? `request failed (${res.status})` };
  return { ok: true, ...json };
}

// ── Comments (client-side, same-origin) ──────────────────────────────────────

export interface ClientComment {
  parentId: number | null;
  authorName: string;
  body: string;
}

export async function clientComments(targetType: "post" | "guide", slug: string) {
  const res = await fetch(`/api/content/${targetType}/${encodeURIComponent(slug)}/comments`, { cache: "no-store" });
  if (!res.ok) throw new ApiError(res.status, `comments → ${res.status}`);
  return (await res.json()) as import("@fg/shared").CommentsPayload;
}

export async function clientSubmitComment(payload: import("@fg/shared").SubmitCommentPayload) {
  const res = await fetch("/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) return { ok: false, error: json.message ?? `request failed (${res.status})` };
  return { ok: true, message: json.message };
}

// ── Newsletter (client-side, same-origin) ────────────────────────────────────

export async function clientSubscribe(payload: { email: string; name?: string; source?: string; website?: string }) {
  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
  if (!res.ok) return { ok: false, error: json.message ?? `request failed (${res.status})` };
  return { ok: true, message: json.message };
}

// ── Analytics beacon (client-side, same-origin) ──────────────────────────────

export function sendPageview(path: string): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    path,
    referrer: document.referrer || undefined,
    vw: Math.round(window.innerWidth / 10) * 10,
  });
  // sendBeacon survives navigation; fetch+keepalive is the fallback.
  if (navigator.sendBeacon) {
    try {
      navigator.sendBeacon("/api/analytics/pageview", new Blob([body], { type: "application/json" }));
      return;
    } catch {
      /* fall through */
    }
  }
  void fetch("/api/analytics/pageview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

// ── Media URL helpers ────────────────────────────────────────────────────────

/** Browser-facing URL for a media key (same-origin; Next rewrites /media/*). */
export function resolveMedia(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.startsWith("http")) return key;
  return `/media/${key.replace(/^\//, "")}`;
}

/** Site-absolute URL for Open Graph / JSON-LD (browser-facing path won't do). */
export function ogImage(key: string | null | undefined): string | null {
  const rel = resolveMedia(key);
  if (!rel) return null;
  if (rel.startsWith("http")) return rel;
  return `${siteUrl()}${rel}`;
}

// ── Content-model discriminators (related: Game | Post | Guide) ─────────────

export const isGame = (x: Game | Post | Guide): x is Game => "playableType" in x;
export const isGuide = (x: Game | Post | Guide): x is Guide => "gameSlug" in x;
export const isPost = (x: Game | Post | Guide): x is Post => "authorSlug" in x && !("gameSlug" in x);

// ── Formatting helpers ───────────────────────────────────────────────────────

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatHudDate(iso: string | null | undefined): string {
  if (!iso) return "— — —";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "— — —";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Thousands separators for scores. */
export function formatScore(n: number): string {
  return n.toLocaleString("en-US");
}
