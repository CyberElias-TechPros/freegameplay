import { isPublicMediaKey } from "@fg/shared/security";
// R2 media passthrough. Keys are content-hashed at upload time, so
// long-lived immutable caching is safe and cheap.

import { Hono } from "hono";
import type { Bindings } from "../worker";

type Env = { Bindings: Bindings };

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
};

export function mediaApp() {
  const app = new Hono<Env>();

  app.get("/media/:key{.+}", async (c) => {
    const key = c.req.param("key") ?? "";
    if (!isPublicMediaKey(key)) return c.json({ error: "not_found" }, 404, { "Cache-Control": "no-store" });
    const obj = await c.env.MEDIA.get(key);
    if (!obj) return c.json({ error: "not_found", message: `Media "${key}" not found` }, 404);
    const ext = key.split(".").pop()?.toLowerCase() ?? "";
    const type = MIME[ext] ?? "application/octet-stream";
    return new Response(obj.body, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(obj.size),
        "Cache-Control": "public, max-age=300, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });

  return app;
}
