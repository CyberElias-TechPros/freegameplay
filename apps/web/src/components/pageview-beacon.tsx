"use client";

// First-party pageview beacon.
//
// Fires once per client-side navigation (Next's App Router doesn't reload the
// document, so a plain effect on pathname is the correct hook). Sends only
// what the analytics table is allowed to hold: the path, the referrer host and
// a coarse viewport bucket. No cookies, no identifiers, no third parties.
//
// It is intentionally fire-and-forget: if the endpoint is unreachable the page
// is unaffected.

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { sendPageview } from "@/lib/api";

export function PageviewBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    // Skip the app's own plumbing — those would drown out real content.
    if (pathname.startsWith("/_next") || pathname.startsWith("/api/") || pathname.startsWith("/media/")) return;
    const id = window.setTimeout(() => sendPageview(pathname), 120);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
