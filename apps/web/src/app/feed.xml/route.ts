import { NextResponse } from "next/server";
import { apiBase } from "@/lib/api";

export const revalidate = 300;

/**
 * RSS 2.0 feed, authored by the content API (same canonical-host pattern as
 * the sitemap). Carries full post HTML in content:encoded, so the same feed
 * import pipeline that pulls in old blogs can pull this one in too.
 */
export async function GET() {
  try {
    const res = await fetch(`${apiBase()}/api/feed.xml`, { next: { revalidate: 300 } });
    if (!res.ok) {
      return new NextResponse("feed unavailable", { status: 503, headers: { "Content-Type": "application/xml" } });
    }
    const xml = await res.text();
    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("feed unavailable", { status: 503, headers: { "Content-Type": "application/xml" } });
  }
}
