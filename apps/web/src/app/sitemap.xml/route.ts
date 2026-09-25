import { NextResponse } from "next/server";
import { apiBase } from "@/lib/api";

export const revalidate = 300;

/**
 * Sitemap is authored by the content API (it knows every published slug and
 * lastmod, and its SITE_URL binding is the single source of truth). We serve
 * it same-origin so crawlers see one canonical host.
 */
export async function GET() {
  try {
    const res = await fetch(`${apiBase()}/api/sitemap.xml`, { next: { revalidate: 300 } });
    if (!res.ok) {
      return new NextResponse("sitemap unavailable", { status: 503, headers: { "Content-Type": "application/xml" } });
    }
    const xml = await res.text();
    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("sitemap unavailable", { status: 503, headers: { "Content-Type": "application/xml" } });
  }
}
