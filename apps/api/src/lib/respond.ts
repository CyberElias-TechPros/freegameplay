import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export function badRequest(c: Context, message: string): Response {
  return c.json({ error: "bad_request", message }, 400);
}

export function notFound(c: Context, message = "Not found"): Response {
  return c.json({ error: "not_found", message }, 404);
}

export function unauthorized(c: Context, message = "Unauthorized"): Response {
  return c.json({ error: "unauthorized", message }, 401);
}

export function apiError(e: unknown): { status: number; message: string } {
  if (e instanceof HTTPException) return { status: e.status, message: e.message };
  const msg = e instanceof Error ? e.message : String(e);
  return { status: 500, message: msg };
}
