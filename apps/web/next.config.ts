import type { NextConfig } from "next";

// ─────────────────────────────────────────────────────────────────────────────
// The frontend speaks to the content API through SAME-ORIGIN paths
// (/api/*, /media/*) which are rewritten to API_BASE at request time.
//   • sandbox / local preview  → http://127.0.0.1:8787 (wrangler dev)
//   • production (Vercel)      → https://freegameplay-api.<sub>.workers.dev
// One build, both environments. No browser ever needs to know the backend.
// ─────────────────────────────────────────────────────────────────────────────

function apiBase(): string {
  return (process.env.API_BASE ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
}

// Content-Security-Policy.
//
// The site needs: its own origin, the AdSense + Google ad stack (script,
// frame, image, and the connect beacons Consent Mode uses), inline styles from
// React/Framer Motion, and inline scripts for JSON-LD. Everything else is off.
// 'unsafe-inline' for scripts is required by the AdSense snippet; the rest of
// the policy stays strict. When no publisher id is configured, no ad origin is
// allowed at all — the app never even asks for the ad script.
function csp(): string {
  const ads = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);
  const scriptSrc = [
    "'self'",
    ...(process.env.NODE_ENV === "development" ? ["'unsafe-eval'"] : []),
    "'unsafe-inline'", // required by the AdSense snippet + Next inline bootstrap
    ...(ads ? ["https://pagead2.googlesyndication.com", "https://partner.googleadservices.com", "https://tpc.googlesyndication.com"] : []),
  ];
  const frameSrc = ["'self'", ...(ads ? ["https://googleads.g.doubleclick.net", "https://tpc.googlesyndication.com"] : [])];
  const imgSrc = ["'self'", "data:", "blob:", ...(ads ? ["https://pagead2.googlesyndication.com", "https://googleads.g.doubleclick.net", "https://tpc.googlesyndication.com"] : [])];
  const connectSrc = [
    "'self'",
    ...(ads ? ["https://pagead2.googlesyndication.com", "https://googleads.g.doubleclick.net"] : []),
  ];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${imgSrc.join(" ")}`,
    "font-src 'self' data:",
    `frame-src ${frameSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    process.env.NODE_ENV === "development" ? "frame-ancestors 'self' https://arena.ai https://*.arena.ai https://*.e2b.app" : "frame-ancestors 'none'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1", "*.e2b.app"],
  transpilePackages: ["@fg/shared", "@fg/game-core"],
  poweredByHeader: false,
  reactStrictMode: true,

  async rewrites() {
    const base = apiBase();
    return [
      { source: "/api/:path*", destination: `${base}/api/:path*` },
      { source: "/media/:path*", destination: `${base}/media/:path*` },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(process.env.NODE_ENV === "development" ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },

    ];
  },
};

export default nextConfig;
