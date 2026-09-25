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

const nextConfig: NextConfig = {
  transpilePackages: ["@fg/shared"],
  poweredByHeader: false,
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
        source: "/media/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
