// Typed client for the FreeGameplay content API.
// Server components fetch through API_BASE directly; the browser only ever
// sees same-origin paths (Next rewrites /api/* and /media/* to the backend).

import type {
  Category,
  CategoryDetailPayload,
  DetailPayload,
  Game,
  GamesListPayload,
  Guide,
  HomePayload,
  Page,
  Post,
  PostsListPayload,
  SearchHit,
  SearchPayload,
  Tag,
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

// ── Queries (server-side) ────────────────────────────────────────────────────

export const q = {
  home: (revalidate = 60) => get<HomePayload>("/api/content/home", revalidate),
  games: (params: Record<string, string | undefined> = {}, revalidate = 60) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
      .join("&");
    return get<GamesListPayload>(`/api/content/games${qs ? `?${qs}` : ""}`, revalidate);
  },
  game: (slug: string) => get<DetailPayload<Game>>(`/api/content/games/${encodeURIComponent(slug)}`, 300),
  posts: (params: Record<string, string | undefined> = {}, revalidate = 60) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
      .join("&");
    return get<PostsListPayload>(`/api/content/posts${qs ? `?${qs}` : ""}`, revalidate);
  },
  post: (slug: string) => get<DetailPayload<Post>>(`/api/content/posts/${encodeURIComponent(slug)}`, 300),
  guides: (params: Record<string, string | undefined> = {}, revalidate = 60) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
      .join("&");
    return get<{ items: Guide[]; total: number; page: number; pageSize: number; pages: number }>(
      `/api/content/guides${qs ? `?${qs}` : ""}`,
      revalidate,
    );
  },
  guide: (slug: string) => get<DetailPayload<Guide>>(`/api/content/guides/${encodeURIComponent(slug)}`, 300),
  categories: () => get<{ items: Category[] }>("/api/content/categories", 300),
  category: (slug: string) => get<CategoryDetailPayload>(`/api/content/categories/${encodeURIComponent(slug)}`, 120),
  tags: () => get<{ items: Tag[] }>("/api/content/tags", 300),
  page: (slug: string) => get<{ item: Page }>(`/api/content/pages/${encodeURIComponent(slug)}`, 3600),
};

// ── Search (client-side, same-origin) ────────────────────────────────────────

export async function clientSearch(query: string, types?: string): Promise<SearchPayload> {
  const params = new URLSearchParams({ q: query });
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
