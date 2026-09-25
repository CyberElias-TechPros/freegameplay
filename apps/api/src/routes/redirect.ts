// Legacy URL resolution. The Next.js middleware calls this for any
// Blogger-shaped URL and turns the JSON response into a real 308.
// Responses are negatively cached (30s) so unknown legacy URLs don't
// hammer D1.

import { Hono } from "hono";
import { normalizeLegacyUrl } from "@fg/shared";
import { kvGetJson, kvSetJson } from "../lib/cache";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

export function redirectApp() {
  const app = new Hono<Env>();

  app.get("/redirect", async (c) => {
    const from = c.req.query("from");
    if (!from) return c.json({ status: 404, message: "Missing ?from=" }, 400);

    const normalized = normalizeLegacyUrl(from);
    if (normalized === "/" ) {
      return c.json({ status: 308, location: "/" });
    }

    const cacheKey = "redirect:" + normalized;
    const cached = await kvGetJson<{ status: number; location?: string }>(c.env.CACHE, cacheKey);
    if (cached) return c.json(cached);

    const row = (
      await c.env.DB.prepare(`SELECT from_url, to_url, status_code FROM redirects WHERE from_url = ?`).bind(normalized).first()
    ) as { from_url: string; to_url: string; status_code: number } | null;

    let result: { status: number; location?: string; message?: string };
    if (row) {
      result = { status: row.status_code || 308, location: row.to_url };
    } else {
      result = { status: 404, message: "No redirect registered for " + normalized };
    }
    await kvSetJson(c.env.CACHE, cacheKey, result, row ? 3600 : 30);
    return c.json(result);
  });

  return app;
}
