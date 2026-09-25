import { NextResponse } from "next/server";
import { apiBase, siteUrl } from "@/lib/api";
// siteUrl is used only for the offline fallback below.

export const revalidate = 3600;

export async function GET() {
  try {
    const res = await fetch(`${apiBase()}/api/robots.txt`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const text = await res.text();
      return new NextResponse(text, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  } catch {
    // fall through to the static fallback below
  }
  const text = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl()}/sitemap.xml\n`;
  return new NextResponse(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
