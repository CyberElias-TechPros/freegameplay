import { NextResponse, type NextRequest } from "next/server";

// Paths the app itself owns — never hit the redirect registry for these.
const APP_PREFIXES = [
  "/games",
  "/blog",
  "/guides",
  "/categories",
  "/authors",
  "/tags",
  "/search",
  "/about",
  "/contact",
  "/privacy-policy",
  // the operator console: app-owned, and must never be shadowed by the
  // legacy-URL registry (it is also noindex via route metadata)
  "/admin",
];
const APP_EXACT = new Set(["/"]);
const SKIP_PREFIXES = ["/_next", "/api", "/media", "/favicon", "/icon", "/sitemap.xml", "/robots.txt", "/opengraph"];

/**
 * Legacy-URL preservation.
 *
 * FreeGameplay migrated from Blogger (and an earlier HTML game site). Every
 * old URL lives in the backend's legacy-URL registry and returns a 308 +
 * canonical location. We resolve it at the edge BEFORE rendering so old
 * links, bookmarks and indexed pages keep working with the correct HTTP
 * semantics — exactly what search engines expect from a migration.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/" || APP_EXACT.has(pathname)) return NextResponse.next();
  if (APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const apiBase = (process.env.API_BASE ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
  try {
    const res = await fetch(`${apiBase}/api/redirect?from=${encodeURIComponent(pathname)}`);
    if (!res.ok) return NextResponse.next(); // unknown path → let Next 404 it
    const data = (await res.json()) as { status?: number; location?: string };
    if (data.status === 308 && data.location) {
      const url = new URL(data.location, req.url);
      return NextResponse.redirect(url, 308);
    }
  } catch {
    // API unreachable in this layer: degrade gracefully (no redirect),
    // never block the site because of the registry.
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  // matcher: every page request except files with extensions (static assets)
  matcher: ["/((?!\\.[\\w]+$).*)"],
};
