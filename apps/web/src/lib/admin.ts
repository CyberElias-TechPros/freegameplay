// Admin API client for the operator console at /admin.
//
// The token lives in sessionStorage only: it is entered by the operator at
// runtime, never baked into the bundle and never written to a cookie (a cookie
// would be sent to every third-party request the page makes). Closing the tab
// discards it.
//
// This is the documented trade-off of a static-frontend admin surface. For a
// high-value deployment, put the route behind Cloudflare Access (or an IP
// allowlist) as well — see docs/status.md §6.

const TOKEN_KEY = "fg-admin-token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode — the console just won't remember the session */
  }
}

export interface AdminResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<AdminResult<T>> {
  const token = getAdminToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const message = (data as { message?: string } | undefined)?.message ?? `request failed (${res.status})`;
    return { ok: false, status: res.status, error: message };
  }
  return { ok: true, status: res.status, data: data as T };
}

export const admin = {
  overview: (days = 30) => call<import("@fg/shared").AdminOverview>(`/admin/overview?days=${days}`),
  health: () => call<{ ok: boolean; checks: { db: boolean; r2: boolean; kv: boolean }; counts: Record<string, number> }>("/admin/health"),
  messages: () => call<{ items: import("@fg/shared").ContactMessage[] }>("/admin/messages"),
  setMessageStatus: (id: number, status: string) =>
    call<{ ok: boolean }>(`/admin/messages/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  comments: (status?: string) =>
    call<{ items: import("@fg/shared").AdminComment[]; byStatus: Record<string, number> }>(
      `/admin/comments${status ? `?status=${status}` : ""}`,
    ),
  setCommentStatus: (id: number, status: string) =>
    call<{ ok: boolean }>(`/admin/comments/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  deleteComment: (id: number) => call<{ ok: boolean }>(`/admin/comments/${id}`, { method: "DELETE" }),
  subscribers: (status?: string) =>
    call<{ items: import("@fg/shared").Subscriber[]; totals: Record<string, number> }>(
      `/admin/subscribers${status ? `?status=${status}` : ""}`,
    ),
  deleteSubscriber: (id: number) => call<{ ok: boolean }>(`/admin/subscribers/${id}`, { method: "DELETE" }),
  subscribersExportUrl: () => "/api/admin/subscribers/export",
  scores: (game?: string) => call<{ items: (import("@fg/shared").ScoreEntry & { clientHash: string; elapsedMs: number | null })[] }>(`/admin/scores${game ? `?game=${encodeURIComponent(game)}` : ""}`),
  deleteScore: (id: number) => call<{ ok: boolean }>(`/admin/scores/${id}`, { method: "DELETE" }),
  report: () => call<import("@fg/shared").MigrationReport>("/admin/report"),
  verifyRedirect: (id: number) => call<{ ok: boolean }>(`/admin/redirects/${id}/verify`, { method: "POST" }),
  importFeed: (url: string, dryRun: boolean, downloadMedia: boolean) =>
    call<{ ok: boolean; dryRun: boolean; run: unknown; stats: import("@fg/shared").ImportStats; warnings: string[] }>("/admin/import", {
      method: "POST",
      headers: { "x-dry-run": dryRun ? "1" : "0", "x-import-meta": JSON.stringify({ downloadMedia }) },
      body: JSON.stringify({ url }),
    }),
};
