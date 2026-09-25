// ─────────────────────────────────────────────────────────────────────────────
// Slug + legacy-URL utilities. Blogger URL anatomy:
//   /2024/05/some-post-title.html          → dated post
//   /p/some-page.html                      → static page
//   /2024/05.html                          → date archive (no content)
//   /search/label/foo.html                 → label archive (no content)
//   /2024.html                             → year archive (no content)
// ─────────────────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "untitled";
}

export interface ParsedBloggerUrl {
  kind: "post" | "page" | "archive" | "other";
  slug: string | null;
  year: number | null;
  month: number | null;
}

export function parseBloggerUrl(url: string): ParsedBloggerUrl {
  let path = url;
  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);
  if (path.startsWith("http://") || path.startsWith("https://")) {
    try {
      const u = new URL(path);
      path = u.pathname;
    } catch {
      /* keep raw path */
    }
  }
  path = path.replace(/\/+$/, "") || "/";

  const mPost = path.match(/^\/(\d{4})\/(\d{2})\/([^/]+?)(?:\.html)?$/);
  if (mPost) {
    return { kind: "post", slug: mPost[3] ?? null, year: Number(mPost[1]), month: Number(mPost[2]) };
  }
  const mPage = path.match(/^\/p\/([^/]+?)(?:\.html)?$/);
  if (mPage) {
    return { kind: "page", slug: mPage[1] ?? null, year: null, month: null };
  }
  const mDate = path.match(/^\/(\d{4})\/(\d{2})(?:\.html)?$/);
  if (mDate) {
    return { kind: "archive", slug: null, year: Number(mDate[1]), month: Number(mDate[2]) };
  }
  const mYear = path.match(/^\/(\d{4})(?:\.html)?$/);
  if (mYear) {
    return { kind: "archive", slug: null, year: Number(mYear[1]), month: null };
  }
  const mLabel = path.match(/^\/search\/label\/.*/);
  if (mLabel) {
    return { kind: "archive", slug: null, year: null, month: null };
  }
  return { kind: "other", slug: null, year: null, month: null };
}

/** Normalise a legacy URL for registry lookups: lower-case host, strip protocol+www, one trailing form. */
export function normalizeLegacyUrl(url: string): string {
  let out = url.trim();
  if (!out.startsWith("/")) {
    try {
      const u = new URL(out);
      out = u.pathname + u.search;
      if (out.endsWith("/")) out = out.slice(0, -1);
      if (out === "") out = "/";
      return out;
    } catch {
      out = "/" + out;
    }
  }
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
}

export function readingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
