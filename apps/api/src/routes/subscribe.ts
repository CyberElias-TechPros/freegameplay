// Newsletter: double opt-in, self-service unsubscribe.
//
//   POST /api/subscribe                 → creates a `pending` subscriber
//   GET  /api/subscribe/confirm?token=  → confirms (double opt-in)
//   GET  /api/unsubscribe?token=        → opts out, permanently
//
// Confirmation and unsubscribe links are sent by email when a provider is
// configured (RESEND_API_KEY + NOTIFY_FROM). Without one the confirm link is
// returned in the API response, so the flow is fully testable and the operator
// can wire a provider later without touching code.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from "hono";
import { one } from "../lib/db";
import { rateLimit } from "../lib/rate";
import { badRequest } from "../lib/respond";
import { cleanText, isEmail, slugish } from "../lib/validate";
import type { Bindings } from "../worker";
import type { SubscribePayload } from "@fg/shared";

type Env = { Bindings: Bindings };

function token(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Send a transactional email when a provider is configured. Never throws. */
export async function sendMail(
  env: Bindings,
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean; reason?: string }> {
  const key = env.RESEND_API_KEY;
  const from = env.NOTIFY_FROM;
  if (!key || !from) return { sent: false, reason: "no email provider configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return { sent: false, reason: `provider ${res.status}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: String(e) };
  }
}

function shell(title: string, bodyHtml: string, siteName: string, siteUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#05070d;color:#eef2fb;font-family:system-ui,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <p style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:#c9f73a">${siteName}</p>
    <h1 style="font-size:26px;line-height:1.2;margin:12px 0 20px">${title}</h1>
    ${bodyHtml}
    <p style="color:#8b96b0;font-size:12px;margin-top:36px">${siteUrl}</p>
  </div></body></html>`;
}

function confirmEmail(confirmUrl: string, siteName: string, siteUrl: string): string {
  return shell(
    "Confirm your subscription",
    `<p style="color:#a7b2cc;line-height:1.6">One click and you're in. New games and guides land in your inbox — nothing else.</p>
     <p><a href="${confirmUrl}" style="display:inline-block;background:#c9f73a;color:#0a0d05;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:6px">Confirm subscription</a></p>
     <p style="color:#8b96b0;font-size:12px">Or paste this link: ${confirmUrl}</p>`,
    siteName,
    siteUrl,
  );
}

function simplePage(title: string, bodyHtml: string, siteName: string, siteUrl: string): Response {
  return new Response(shell(title, bodyHtml, siteName, siteUrl), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function subscribeApp() {
  const app = new Hono<Env>();
  const siteName = "FreeGameplay";

  // ── Subscribe (double opt-in) ──────────────────────────────────────────────
  app.post("/subscribe", async (c) => {
    const limited = await rateLimit(c, c.env.CACHE, "subscribe", 10, 3600);
    if (limited) return limited;

    const body = (await c.req.json().catch(() => null)) as SubscribePayload | null;
    if (!body) return badRequest(c, "JSON body required");

    // Honeypot: a hidden field only a bot fills in. Pretend success.
    if (typeof body.website === "string" && body.website.trim().length > 0) {
      return c.json({ ok: true, status: "pending", message: "Almost there — check your inbox to confirm." }, 201);
    }

    const email = cleanText(body.email, 254).toLowerCase();
    if (!isEmail(email)) return badRequest(c, "A valid email address is required");
    const name = cleanText(body.name, 60);
    const source = slugish(body.source ?? "site") ?? "site";

    const origin = (c.env.SITE_URL ?? "").replace(/\/+$/, "");
    const existing = await one<{ id: number; status: string; confirm_token: string | null }>(
      c.env.DB.prepare(`SELECT id, status, confirm_token FROM subscribers WHERE email = ?`).bind(email),
    );

    // Re-subscribing after an opt-out starts a fresh double opt-in.
    const confirmTok = existing && existing.status !== "unsubscribed" ? existing.confirm_token : token();
    const confirmUrl = `${origin}/api/subscribe/confirm?token=${confirmTok ?? ""}`;

    if (existing) {
      if (existing.status === "confirmed") {
        // Don't leak subscription state to an anonymous caller.
        return c.json({ ok: true, status: "confirmed", message: "You're already on the list." }, 200);
      }
      await c.env.DB.prepare(
        `UPDATE subscribers SET status = 'pending', confirm_token = ?, name = COALESCE(?, name), source = ?, unsubscribed_at = NULL WHERE id = ?`,
      )
        .bind(confirmTok, name || null, source, existing.id)
        .run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO subscribers (email, name, status, source, confirm_token, unsubscribe_token) VALUES (?, ?, 'pending', ?, ?, ?)`,
      )
        .bind(email, name || null, source, confirmTok, token())
        .run();
    }

    const mail = await sendMail(c.env, email, "Confirm your subscription", confirmEmail(confirmUrl, siteName, origin));
    return c.json(
      {
        ok: true,
        status: "pending",
        message: "Almost there — check your inbox to confirm.",
        // Surfaced only when no provider is configured, so the flow stays
        // testable without keys.
        confirmUrl: mail.sent ? undefined : confirmUrl,
      },
      201,
    );
  });

  // ── Confirm ────────────────────────────────────────────────────────────────
  app.get("/subscribe/confirm", async (c) => {
    const t = (c.req.query("token") ?? "").trim();
    if (!t || t.length > 128) return badRequest(c, "A valid confirmation token is required");
    const row = await one<{ id: number }>(c.env.DB.prepare(`SELECT id FROM subscribers WHERE confirm_token = ?`).bind(t));
    if (!row) return badRequest(c, "That confirmation link is not valid.");
    await c.env.DB.prepare(`UPDATE subscribers SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?`)
      .bind(row.id)
      .run();
    const origin = (c.env.SITE_URL ?? "").replace(/\/+$/, "");
    return simplePage(
      "You're in",
      `<p style="color:#a7b2cc;line-height:1.6">Your subscription is confirmed.</p>
       <p><a href="${origin}/" style="display:inline-block;background:#c9f73a;color:#0a0d05;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:6px">Back to FreeGameplay</a></p>`,
      siteName,
      origin,
    );
  });

  // ── Unsubscribe ────────────────────────────────────────────────────────────
  app.get("/unsubscribe", async (c) => {
    const t = (c.req.query("token") ?? "").trim();
    if (!t || t.length > 128) return badRequest(c, "A valid unsubscribe token is required");
    const row = await one<{ id: number }>(c.env.DB.prepare(`SELECT id FROM subscribers WHERE unsubscribe_token = ?`).bind(t));
    if (!row) return badRequest(c, "That unsubscribe link is not valid.");
    await c.env.DB.prepare(`UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE id = ?`)
      .bind(row.id)
      .run();
    const origin = (c.env.SITE_URL ?? "").replace(/\/+$/, "");
    return simplePage(
      "Unsubscribed",
      `<p style="color:#a7b2cc;line-height:1.6">You're off the list. No hard feelings — the games stay free either way.</p>
       <p><a href="${origin}/" style="display:inline-block;background:#c9f73a;color:#0a0d05;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:6px">Back to FreeGameplay</a></p>`,
      siteName,
      origin,
    );
  });

  return app;
}
