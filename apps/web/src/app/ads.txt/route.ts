import { NextResponse } from "next/server";
import { publisherId } from "@/lib/ads";

// ads.txt — required by AdSense/Google so publishers' ad inventory is
// verifiable. MUST live at the site root and name the publisher id exactly.
export async function GET() {
  return new NextResponse(`google.com, ${publisherId()}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
